import { Component, Input, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CartService,
  estimateStockUnits,
} from '../../../core/services/cart.service';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { calculateLocalPrice } from '../../../core/lib/pricing.util';
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
    return this.cart.remainingPacks(
      this.product.id,
      Number(this.variant.units_per_pack) || 1,
      estimateStockUnits(this.product.variants ?? []),
    );
  }

  get inCart(): boolean {
    return this.cart.cartItems().some((i) => i.variantId === this.variant.id);
  }

  /** Precio por presentación considerando lo que ya hay en el carrito (descuento por volumen). */
  get pricing() {
    const inCart =
      this.cart.cartItems().find((i) => i.variantId === this.variant.id)
        ?.quantity ?? 0;
    const config =
      this.pricingConfigService.pricingConfig() ?? this.product.pricing_config;
    return calculateLocalPrice(
      Number(this.product.cost_usd) || 0,
      Number(this.product.units_per_pack_master) || 1,
      Number(this.variant.units_per_pack) || 1,
      Math.max(1, this.quantity() + inCart),
      this.variant.cost_currency,
      config,
      this.variant.has_packaging,
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
    const p = this.product;
    const v = this.variant;
    const price = this.pricing;
    await this.cart.add({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      slug: p.slug,
      sku: v.sku,
      price_ars: price.price_ars,
      price_usd: price.price_usd,
      cost_currency: v.cost_currency,
      cost_usd: v.cost_usd,
      cost_usd_master: p.cost_usd,
      quantity: this.quantity(),
      imageUrl: this.imageUrl ?? p.images?.[0]?.url ?? '',
      stock: v.stock,
      units_per_pack: v.units_per_pack,
      units_per_pack_master: p.units_per_pack_master,
      has_packaging: v.has_packaging,
      volume_cc: v.dimensions?.volume_cc,
      product_volume_cc: p.volume_cc ?? null,
    });
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
