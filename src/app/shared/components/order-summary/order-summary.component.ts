import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.css'
})
export class OrderSummaryComponent {
  public readonly cartService = inject(CartService);
  public readonly shippingService = inject(ShippingService);
  public readonly paymentMethodService = inject(PaymentMethodService);
  public readonly pricingConfigService = inject(PricingConfigService);

  @Input() footerLinkLabel = 'VOLVER AL CARRITO';
  @Input() footerLinkRoute = '/carrito';
  @Input() footerLinkIcon = 'bi-basket';
  @Input() showItemsList = true;
  @Input() showPaymentMethod = true;
  @Input() showBoxesDetail = true;

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

  get totalConEnvio(): number {
    return this.cartService.subtotalArs() + (this.shippingCost ?? 0);
  }

  /**
   * Subtotal ANTES del descuento por volumen. Se deriva del subtotal ya
   * descontado (cartService.subtotalArs()) y del porcentaje promedio de
   * descuento (cartService.volumeDiscountPercentage()), porque el carrito
   * no guarda un monto "bruto" por separado: el descuento ya viene aplicado
   * dentro de cada price_ars. Es una aproximación de visualización.
   */
  get subtotalBrutoArs(): number {
    const pct = this.cartService.volumeDiscountPercentage();
    const neto = this.cartService.subtotalArs();
    if (!pct) return neto;
    return Math.round(neto / (1 - pct / 100));
  }

  paymentMethodLabel(): string {
    const m = this.paymentMethodService.current();
    if (m === 'mercadopago') return 'Mercado Pago';
    if (m === 'transferencia') return 'Transferencia';
    return '';
  }
}
