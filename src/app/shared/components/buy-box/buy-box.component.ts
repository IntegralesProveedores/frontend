import { Component, Input, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { presentationPrice, toCartItem } from '../../../core/lib/product-purchase';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { QtySelectorComponent } from '../qty-selector/qty-selector.component';

/** Compra de UNA presentación de un producto: cantidad, precio y carrito. */
@Component({
  selector: 'app-buy-box',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe, QtySelectorComponent],
  templateUrl: './buy-box.component.html',
  styleUrl: './buy-box.component.css',
})
export class BuyBoxComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) variant!: ProductVariant;
  /** Foto del ítem en el carrito (por defecto, la primera del producto). */
  @Input() imageUrl?: string;

  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly pricingConfigService = inject(PricingConfigService);

  readonly quantity = signal(1);
  readonly added = signal(false);

  get inStock(): boolean {
    return this.maxQty > 0;
  }

  /** Packs que todavía se pueden agregar: stock del producto menos lo que ya está en el carrito. */
  get maxQty(): number {
    return this.cart.remainingPacksOf(this.product, this.variant);
  }

  get inCart(): boolean {
    return this.cart.quantityOf(this.variant.id) > 0;
  }

  /** Precio por presentación considerando lo que ya hay en el carrito (descuento por volumen). */
  get pricing() {
    return presentationPrice(
      this.product,
      this.variant,
      this.quantity() + this.cart.quantityOf(this.variant.id),
      this.pricingConfigService.pricingConfig(),
    );
  }

  get totalArs(): number {
    return this.pricing.price_ars * this.quantity();
  }

  get totalUnits(): number {
    return this.variant.units_per_pack * this.quantity();
  }

  decrement(): void {
    if (this.quantity() > 1) this.quantity.update((q) => q - 1);
  }

  increment(): void {
    if (this.quantity() < this.maxQty) this.quantity.update((q) => q + 1);
  }

  async addToCart(): Promise<boolean> {
    if (!this.inStock) return false;
    if (this.quantity() > this.maxQty) this.quantity.set(this.maxQty);
    const price = this.pricing;
    await this.cart.add(
      toCartItem(this.product, this.variant, {
        quantity: this.quantity(),
        price_ars: price.price_ars,
        price_usd: price.price_usd,
        imageUrl: this.imageUrl,
      }),
    );
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
    return true;
  }

  /** Si la presentación ya está en el carrito, va directo a pagar sin sumar otra vez la cantidad. */
  async buyNow(): Promise<void> {
    if (this.inCart || (await this.addToCart()))
      this.router.navigate(['/finalizar-compra']);
  }
}
