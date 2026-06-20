import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { ProgressiveImageComponent } from '../progressive-image/progressive-image.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe, ProgressiveImageComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;

  private cart = inject(CartService);

  added = false;

  get mainImage(): string {
    const img = this.product.images?.[0]?.url;
    return img || 'assets/images/placeholder.webp';
  }

  get variant(): ProductVariant | null {
	  const master = this.product.units_per_pack_master;
	  if (master) {
		return this.product.variants.find(v => v.units_per_pack === master) ?? this.product.variants[0] ?? null;
	  }
	  return this.product.variants[0] ?? null;
	}

  get inStock(): boolean {
    return (this.variant?.stock ?? 0) > 0;
  }

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.variant || !this.inStock) return;

    this.cart.add({
      variantId: this.variant.id,
      productId: this.product.id,
      productName: this.product.name,
      slug: this.product.slug,
      sku: this.variant.sku,
      price_ars: this.variant.price_ars,
      price_usd: this.variant.price_usd,
      cost_usd: this.variant.cost_usd,
      quantity: 1,
      imageUrl: this.mainImage,
      stock: this.variant.stock,
      units_per_pack: this.variant.units_per_pack,
      volume_cc: this.variant.dimensions?.volume_cc || (this.variant as any).volume_cc
    });

    this.added = true;
    setTimeout(() => this.added = false, 1800);
  }
}
