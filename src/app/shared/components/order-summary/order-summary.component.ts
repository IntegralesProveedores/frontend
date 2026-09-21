import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { PackagingService } from '../../../core/services/packaging.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { getEstimatedDeliveryRange } from '../../utils/business-days.util';
import { imageVariant, fallbackToOriginal } from '../../../shared/utils/image-variant.util';
import { productLink } from '../../../core/lib/landing-variants';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.css',
})
export class OrderSummaryComponent {
  readonly productLink = productLink;
  readonly thumb = (url: string) => imageVariant(url, 'thumb');
  readonly useOriginal = fallbackToOriginal;
  public readonly cartService = inject(CartService);
  public readonly shippingService = inject(ShippingService);
  public readonly packagingService = inject(PackagingService);
  public readonly paymentMethodService = inject(PaymentMethodService);
  public readonly pricingConfigService = inject(PricingConfigService);

  @Input() showItemsList = true;
  @Input() showPaymentMethod = true;
  @Input() showBoxesDetail = true;
  @Input() actionMode: 'cart' | 'checkout' | 'none' = 'cart';
  @Input() checkoutFormId = 'checkoutForm';
  @Input() submitting = false;

  get shippingMethod() {
    return this.shippingService.current().method;
  }

  get shippingQuote() {
    return this.shippingService.quote();
  }

  get shippingCost() {
    return this.shippingService.shippingCost();
  }

  get shippingQuoting(): boolean {
    return this.shippingService.quoting();
  }

  readonly estimatedDelivery = getEstimatedDeliveryRange();

  /** El descuento por transferencia solo se aplica en el checkout: en el carrito todavía no se eligió el medio de pago. */
  get discountArs(): number {
    return this.actionMode === 'checkout'
      ? this.cartService.paymentDiscountArs()
      : 0;
  }

  get totalConEnvio(): number {
    return (
      this.cartService.subtotalArs() +
      this.cartService.embalajeArs() +
      this.cartService.shippingArs() -
      this.discountArs
    );
  }

  /**
   * Subtotal ANTES del descuento por volumen. Se deriva del subtotal ya
   * descontado (cartService.subtotalArs()) y del porcentaje promedio de
   * descuento (cartService.volumeDiscountPercentage()), porque el carrito
   * no guarda un monto "bruto" por separado: el descuento ya viene aplicado
   * dentro de cada price_ars. Es una aproximación de visualización.
   */
  get subtotalSinDescuentoArs(): number {
    return this.cartService
      .groupedCartItems()
      .reduce((sum, i) => sum + i.subtotalArsNoDiscount, 0);
  }

  get subtotalSinImpuestosArs(): number {
    return this.cartService
      .cartItems()
      .reduce(
        (sum, i) => sum + (i.price_sin_impuestos_ars ?? 0) * i.quantity,
        0,
      );
  }

  paymentMethodLabel(): string {
    const m = this.paymentMethodService.current();
    if (m === 'mercadopago') return 'Mercado Pago';
    if (m === 'transferencia') return 'Transferencia';
    return '';
  }
}
