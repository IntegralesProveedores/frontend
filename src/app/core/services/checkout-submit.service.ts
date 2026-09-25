import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { CartService } from './cart.service';
import { ShippingService } from './shipping.service';
import { PackagingService } from './packaging.service';
import { PaymentMethodService } from './payment-method.service';
import { CheckoutAttemptService } from './checkout-attempt.service';
import { CustomerDraft, CustomerDraftService } from './customer-draft.service';
import { MercadoPagoService } from './mercadopago.service';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Envío del pedido desde el checkout: arma lo que se le manda al backend,
//           confirma por transferencia (POST /orders) o arranca Mercado Pago, limpia el
//           estado al concretarse y clasifica los rechazos que el cliente puede resolver.
// POR QUÉ:  Antes vivía dentro de CheckoutComponent junto con el formulario. La pantalla
//           ahora solo muestra y reacciona; el camino de la plata queda en un lugar.
// ─────────────────────────────────────────────────────────────

/** Rechazos del backend que no mandan a la pantalla de error: el cliente puede reintentar. */
export type CheckoutFailure = 'insufficient_stock' | 'idempotency_conflict' | 'price_changed';

type ValidatedOrder = {
  items: Array<{
    sku: string;
    product_name: string;
    quantity: number;
    units_per_pack: number;
    price_usd: number;
    subtotal_usd: number;
    price_ars: number;
    subtotal_ars: number;
  }>;
  total_ars: number;
  shipping_ars: number;
  total_usd: number;
  exchange_rate: number;
  order_ref: string;
  payment_method?: 'mercadopago' | 'transferencia';
  payment_discount_percentage?: number;
  payment_discount_amount?: number;
};

/**
 * - "Insufficient stock…" (400/409): no alcanza el stock, el cliente ajusta el carrito.
 * - 409 idempotency_conflict: la key del intento ya se usó para otro pedido o una orden cancelada.
 * - 409 price_changed: el total cambió desde que se mostró.
 */
export function classifyCheckoutError(error: unknown): CheckoutFailure | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const code = error.error?.error;
  if (typeof code === 'string' && code.startsWith('Insufficient stock')) return 'insufficient_stock';
  if (error.status !== 409) return null;
  if (code === 'idempotency_conflict') return 'idempotency_conflict';
  if (code === 'price_changed') return 'price_changed';
  return null;
}

@Injectable({ providedIn: 'root' })
export class CheckoutSubmitService {
  private readonly api = inject(ApiService);
  private readonly cartService = inject(CartService);
  private readonly shippingService = inject(ShippingService);
  private readonly packagingService = inject(PackagingService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly checkoutAttemptService = inject(CheckoutAttemptService);
  private readonly customerDraftService = inject(CustomerDraftService);
  private readonly mercadoPagoService = inject(MercadoPagoService);

  shippingMethod() {
    return this.shippingService.current().method ?? 'delivery';
  }

  /** Formulario válido, envío elegido, embalaje cotizado y carrito con algo. */
  canSubmit(formValid: boolean | null): boolean {
    return (
      !!formValid &&
      this.shippingService.isValid() &&
      this.packagingService.ready() &&
      !this.cartService.isEmpty()
    );
  }

  /** El destinatario del envío es el cliente del formulario. */
  setShippingRecipient(nombre: string): void {
    if (this.shippingMethod() !== 'delivery') return;
    const address = this.shippingService.current().address;
    if (address)
      this.shippingService.setAddress({ ...address, recipient_name: nombre });
  }

  /** Confirma el pedido por transferencia y, si se creó, limpia carrito, borrador e intento. */
  async submitTransfer(
    customer: CustomerDraft,
    captchaToken: string | null,
  ): Promise<{ orderRef: string; paymentMethod: string }> {
    const payload = this.buildOrderPayload(customer, captchaToken);
    const result = await firstValueFrom(
      this.api.post<ValidatedOrder>('/orders', payload),
    );
    this.cartService.clear();
    this.customerDraftService.clear();
    this.checkoutAttemptService.clear();
    this.shippingService.clear();
    this.paymentMethodService.clear();
    return { orderRef: result.order_ref, paymentMethod: payload.payment_method };
  }

  /**
   * Crea el pago y redirige a Mercado Pago. Los datos NO se borran al salir: si el cliente
   * vuelve sin pagar, el formulario sigue completo. Se limpian recién en /orden/exito.
   */
  async startMercadoPago(customer: CustomerDraft, captchaToken: string | null): Promise<void> {
    this.customerDraftService.setCustomer({ ...customer });
    await this.mercadoPagoService.startCheckout(
      this.buildOrderPayload(customer, captchaToken),
    );
  }

  /** Deja todo listo para que el cliente vuelva a confirmar después de un rechazo recuperable. */
  async recoverFrom(failure: CheckoutFailure): Promise<void> {
    if (failure === 'idempotency_conflict') {
      // El próximo intento lleva una key nueva.
      this.checkoutAttemptService.clear();
    } else if (failure === 'price_changed') {
      await this.cartService.refreshPricing();
      this.shippingService.refreshQuote();
    }
  }

  /** Pedido compartido entre transferencia (/orders) y Mercado Pago (/payments/create).
   *  Llamar después de setShippingRecipient() para que la dirección lleve el destinatario. */
  private buildOrderPayload(customer: CustomerDraft, captchaToken: string | null) {
    const order = {
      items: this.cartService.cartItems().map((i) => ({
        variant_id: i.variantId,
        quantity: i.quantity,
      })),
      customer: {
        nombre: customer.nombre,
        email: customer.email,
        cuit: customer.cuit,
        codigoArea: customer.codigoArea,
        celular: customer.celular,
      },
      payment_method: this.paymentMethodService.current() ?? 'mercadopago',
      expected_total_ars: this.cartService.totalAPagar(),
      shipping: {
        method: this.shippingMethod(),
        ...(this.shippingMethod() === 'delivery'
          ? { address: { ...this.shippingService.current().address! } }
          : {}),
      },
    };
    return {
      ...order,
      turnstile_token: captchaToken ?? undefined,
      // Mismo pedido → misma key (doble click, recarga); pedido distinto → key nueva.
      idempotency_key: this.checkoutAttemptService.getOrCreateKey(
        JSON.stringify(order),
      ),
    };
  }
}
