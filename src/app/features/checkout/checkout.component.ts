import {
  Component,
  inject,
  effect,
  OnInit,
  OnDestroy,
  signal,
  computed,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, PaymentTransferInfo } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { SessionContextService } from '../../core/services/session-context.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { MercadoPagoService } from '../../core/services/mercadopago.service';
import { ShippingService } from '../../core/services/shipping.service';
import { CustomerDraftService } from '../../core/services/customer-draft.service';
import { PaymentMethodService } from '../../core/services/payment-method.service';
import { logError } from '../../shared/utils/log.util';

import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { RelatedProductsComponent } from '../../shared/components/related-products/related-products.component';
import { OrderSummaryComponent } from '../../shared/components/order-summary/order-summary.component';
import { ShippingSelectorComponent } from '../../shared/components/shipping-selector/shipping-selector.component';
import { CheckoutSkeletonComponent } from '../../shared/components/checkout-skeleton/checkout-skeleton.component';

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
  payment_commission_percentage?: number;
  payment_commission_amount?: number;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CurrencyArsPipe,
    RelatedProductsComponent,
    OrderSummaryComponent,
    ShippingSelectorComponent,
    CheckoutSkeletonComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  public readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);
  public readonly session = inject(SessionContextService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly mercadoPagoService = inject(MercadoPagoService);
  private readonly customerDraftService = inject(CustomerDraftService);
  public readonly paymentMethodService = inject(PaymentMethodService);
  public readonly shippingService = inject(ShippingService);
  private skipDraftPersistence = false;

  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  loading = false;
  paymentLoading = false;
  formSubmitted = false;
  ready = signal(false);
  shipping = this.shippingService.current;
  shippingMethod = computed(
    () => this.shippingService.current().method ?? 'delivery',
  );
  shippingFormSubmitted = false;

  readonly shippingCost = computed(() =>
    this.shippingMethod() === 'delivery'
      ? (this.shippingService.quote()?.price_ars ?? null)
      : 0,
  );

  // TODO: sumar shipping_amount al total real de la orden en el backend (fase pendiente).
  readonly totalConEnvio = this.cartService.totalConComision;

  customer = {
    nombre: '',
    email: '',
    cuit: '',
    codigoArea: '',
    celular: '',
  };

  mercadoPagoTransferInfo = signal<PaymentTransferInfo | null>(null);
  copiedField = signal<'alias' | 'cvu' | null>(null);
  private copiedFieldTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => this.ready.set(true));

    effect(() => {
      const user = this.session.currentUser();
      if (user) {
        this.customer = {
          nombre: user.fullName,
          email: user.email,
          cuit: user.taxId,
          codigoArea: user.phone.areaCode,
          celular: user.phone.number,
        };
      }
    });
  }

  ngOnInit(): void {
    if (!this.session.isAuthenticated()) {
      const draft = this.customerDraftService.current();
      if (draft) Object.assign(this.customer, draft);
    }

    this.productsService.getProducts().subscribe({
      error: (error) => logError('Error al cargar otros productos:', error),
    });

    this.api.getPaymentTransferInfo().subscribe({
      next: (accounts) => {
        const mercadoPago =
          accounts.find((account) => account.bank_name === 'Mercado Pago') ??
          null;
        this.mercadoPagoTransferInfo.set(mercadoPago);
      },
      error: (error) =>
        logError('Error al cargar datos de transferencia:', error),
    });

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
    }
  }

  filterNumericInput(event: Event, field: 'codigoArea' | 'celular'): void {
    const input = event.target as HTMLInputElement;
    const maxLength = field === 'codigoArea' ? 4 : 8;
    const value = input.value.replace(/\D/g, '').slice(0, maxLength);
    if (input.value !== value) input.value = value;
    this.customer[field] = value;
  }

  onCuitInput(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);

    let formatted = '';
    if (value.length > 0) {
      formatted = value.substring(0, 2);
      if (value.length > 2) {
        formatted += '-' + value.substring(2, 10);
        if (value.length > 10) {
          formatted += '-' + value.substring(10, 11);
        }
      }
    }
    this.customer.cuit = formatted;
  }

  async confirmarPedido(isValid: boolean | null) {
    this.formSubmitted = true;
    this.shippingFormSubmitted = true;

    this.setShippingRecipient();

    if (!isValid || !this.shippingValid || this.cartService.isEmpty()) {
      return;
    }

    this.loading = true;
    const c = this.customer;
    const cartItems = this.cartService.cartItems();

    try {
      this.setShippingRecipient();

      const payload = {
        items: cartItems.map((i) => ({
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
        customer: {
          nombre: c.nombre,
          email: c.email,
          cuit: c.cuit,
          codigoArea: c.codigoArea,
          celular: c.celular,
        },
        payment_method: this.paymentMethodService.current() ?? 'mercadopago',
        payment_commission_percentage:
          this.cartService.paymentCommissionPercentage(),
        payment_commission_amount: this.cartService.paymentCommissionArs(),
        shipping: {
          method: this.shippingMethod()!,
          ...(this.shippingMethod() === 'delivery'
            ? { address: { ...this.shippingService.current().address! } }
            : {}),
        },
      };

      const result = await firstValueFrom(
        this.api.post<ValidatedOrder>('/orders', payload),
      );

      this.skipDraftPersistence = true;
      this.cartService.clear();
      this.customerDraftService.clear();
      this.shippingService.clear();
      this.paymentMethodService.clear();
      this.router.navigate(['/orden/exito'], {
        state: {
          orderRef: result.order_ref,
          paymentMethod: payload.payment_method,
          transferInfo:
            payload.payment_method === 'transferencia'
              ? this.mercadoPagoTransferInfo()
              : null,
        },
      });
    } catch (error) {
      logError('Error en checkout:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.loading = false;
    }
  }

  async iniciarPagoMercadoPago(isValid: boolean | null): Promise<void> {
    this.formSubmitted = true;
    this.shippingFormSubmitted = true;

    this.setShippingRecipient();

    if (!isValid || !this.shippingValid || this.cartService.isEmpty()) {
      return;
    }

    this.paymentLoading = true;
    const c = this.customer;

    try {
      this.setShippingRecipient();

      await this.mercadoPagoService.startCheckout({
        items: this.cartService.cartItems().map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        customer: {
          nombre: c.nombre,
          email: c.email,
          cuit: c.cuit,
          codigoArea: c.codigoArea,
          celular: c.celular,
        },
        payment_method: this.paymentMethodService.current() ?? 'mercadopago',
        payment_commission_percentage:
          this.cartService.paymentCommissionPercentage(),
        payment_commission_amount: this.cartService.paymentCommissionArs(),
        shipping: {
          method: this.shippingMethod()!,
          ...(this.shippingMethod() === 'delivery'
            ? { address: { ...this.shippingService.current().address! } }
            : {}),
        },
      });

      this.skipDraftPersistence = true;
      this.customerDraftService.clear();
      this.shippingService.clear();
      this.paymentMethodService.clear();
    } catch (error) {
      logError('Error al iniciar Mercado Pago:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.paymentLoading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.copiedFieldTimer) clearTimeout(this.copiedFieldTimer);

    if (this.skipDraftPersistence) return;

    if (!this.session.isAuthenticated()) {
      this.customerDraftService.setCustomer({ ...this.customer });
    }

    this.setShippingRecipient();
  }

  private setShippingRecipient(): void {
    if (this.shippingMethod() !== 'delivery') return;
    const address = this.shippingService.current().address;
    if (address)
      this.shippingService.setAddress({
        ...address,
        recipient_name: this.customer.nombre,
      });
  }

  async pagarAhora(isValid: boolean | null): Promise<void> {
    this.formSubmitted = true;
    this.shippingFormSubmitted = true;
    const method = this.paymentMethodService.current();
    if (
      !method ||
      !isValid ||
      !this.shippingValid ||
      this.cartService.isEmpty()
    )
      return;

    if (method === 'mercadopago') {
      await this.iniciarPagoMercadoPago(isValid);
      return;
    }

    await this.confirmarPedido(isValid);
  }

  selectPaymentMethod(method: 'mercadopago' | 'transferencia'): void {
    this.paymentMethodService.setMethod(method);
  }

  async copyToClipboard(value: string, field: 'alias' | 'cvu'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      if (this.copiedFieldTimer) clearTimeout(this.copiedFieldTimer);
      this.copiedField.set(field);
      this.copiedFieldTimer = setTimeout(() => {
        this.copiedField.set(null);
        this.copiedFieldTimer = null;
      }, 1500);
    } catch (error) {
      logError('Error al copiar al portapapeles:', error);
    }
  }

  get shippingValid(): boolean {
    return this.shippingService.isValid();
  }
}
