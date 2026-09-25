import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  afterNextRender,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, PaymentTransferInfo } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { ShippingService } from '../../core/services/shipping.service';
import { PackagingService } from '../../core/services/packaging.service';
import { CustomerDraftService } from '../../core/services/customer-draft.service';
import {
  CheckoutSubmitService,
  classifyCheckoutError,
} from '../../core/services/checkout-submit.service';
import { PaymentMethodService } from '../../core/services/payment-method.service';
import { logError } from '../../shared/utils/log.util';
import { BUSINESS_WHATSAPP_URL } from '../../shared/constants/contact.constants';

import { RelatedProductsComponent } from '../../shared/components/related-products/related-products.component';
import { OrderSummaryComponent } from '../../shared/components/order-summary/order-summary.component';
import { ShippingSelectorComponent } from '../../shared/components/shipping-selector/shipping-selector.component';
import { CheckoutSkeletonComponent } from '../../shared/components/checkout-skeleton/checkout-skeleton.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { TurnstileComponent } from '../../shared/components/turnstile/turnstile.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    BreadcrumbComponent,
    RelatedProductsComponent,
    OrderSummaryComponent,
    ShippingSelectorComponent,
    CheckoutSkeletonComponent,
    TurnstileComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  public readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly customerDraftService = inject(CustomerDraftService);
  private readonly checkoutSubmit = inject(CheckoutSubmitService);
  public readonly paymentMethodService = inject(PaymentMethodService);
  public readonly shippingService = inject(ShippingService);
  public readonly packagingService = inject(PackagingService);
  private skipDraftPersistence = false;
  @ViewChild(TurnstileComponent) private turnstile?: TurnstileComponent;

  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  loading = false;
  paymentLoading = false;
  formSubmitted = false;
  ready = signal(false);
  shipping = this.shippingService.current;
  shippingMethod = computed(() => this.checkoutSubmit.shippingMethod());
  shippingFormSubmitted = false;
  captchaToken = signal<string | null>(null);
  captchaMissing = signal(false);
  /** El backend rechazó la orden porque el total cambió desde que se mostró. */
  priceChanged = signal(false);
  /** El backend rechazó el pedido porque no alcanza el stock. */
  insufficientStock = signal(false);
  /** El backend no reconoció el intento anterior (409 idempotency_conflict): hay que confirmar de nuevo. */
  retryNeeded = signal(false);
  readonly whatsappUrl = BUSINESS_WHATSAPP_URL;

  readonly shippingCost = computed(() =>
    this.shippingMethod() === 'delivery'
      ? (this.shippingService.quote()?.price_ars ?? null)
      : 0,
  );

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
  }

  ngOnInit(): void {
    const draft = this.customerDraftService.current();
    if (draft) Object.assign(this.customer, draft);

    // El total se calcula en el navegador: tomar la configuración de precios vigente antes de pagar.
    void this.cartService.refreshPricing();

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
    if (!this.startAttempt(isValid)) return;
    this.loading = true;

    try {
      const result = await this.checkoutSubmit.submitTransfer(
        this.customer,
        this.captchaToken(),
      );
      this.skipDraftPersistence = true;
      this.router.navigate(['/orden/exito'], {
        state: {
          orderRef: result.orderRef,
          paymentMethod: result.paymentMethod,
          transferInfo:
            result.paymentMethod === 'transferencia'
              ? this.mercadoPagoTransferInfo()
              : null,
        },
      });
    } catch (error) {
      if (await this.recover(error)) return;
      logError('Error en checkout:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.loading = false;
    }
  }

  async iniciarPagoMercadoPago(isValid: boolean | null): Promise<void> {
    if (!this.startAttempt(isValid)) return;
    this.paymentLoading = true;

    try {
      await this.checkoutSubmit.startMercadoPago(this.customer, this.captchaToken());
    } catch (error) {
      if (await this.recover(error)) return;
      logError('Error al iniciar Mercado Pago:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.paymentLoading = false;
    }
  }

  /** Limpia los avisos del intento anterior, marca el formulario y dice si se puede enviar. */
  private startAttempt(isValid: boolean | null): boolean {
    this.priceChanged.set(false);
    this.insufficientStock.set(false);
    this.retryNeeded.set(false);
    this.formSubmitted = true;
    this.shippingFormSubmitted = true;
    this.checkoutSubmit.setShippingRecipient(this.customer.nombre);
    return this.checkoutSubmit.canSubmit(isValid);
  }

  /**
   * Rechazos que el cliente puede resolver sin ir a la pantalla de error: se avisa acá y
   * puede confirmar de nuevo. En todos hace falta otro captcha: el backend ya usó el token.
   */
  private async recover(error: unknown): Promise<boolean> {
    const failure = classifyCheckoutError(error);
    if (!failure) return false;
    this.turnstile?.reset();
    await this.checkoutSubmit.recoverFrom(failure);
    if (failure === 'insufficient_stock') this.insufficientStock.set(true);
    else if (failure === 'idempotency_conflict') this.retryNeeded.set(true);
    else this.priceChanged.set(true);
    return true;
  }

  ngOnDestroy(): void {
    if (this.copiedFieldTimer) clearTimeout(this.copiedFieldTimer);

    if (this.skipDraftPersistence) return;

    this.customerDraftService.setCustomer({ ...this.customer });

    this.checkoutSubmit.setShippingRecipient(this.customer.nombre);
  }

  onCaptchaToken(token: string | null): void {
    this.captchaToken.set(token);
    if (token) this.captchaMissing.set(false);
  }

  async pagarAhora(isValid: boolean | null): Promise<void> {
    this.formSubmitted = true;
    this.shippingFormSubmitted = true;
    const method = this.paymentMethodService.current();
    if (!method || !this.checkoutSubmit.canSubmit(isValid)) return;

    if (!this.captchaToken()) {
      this.captchaMissing.set(true);
      return;
    }

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
}
