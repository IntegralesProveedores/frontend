import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { PriceService } from '../../../core/services/price.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;

  private cart = inject(CartService);
  private priceService = inject(PriceService);

  added = false;

  // Computed para el precio actual basado en la lógica centralizada
  currentPricing = computed(() => {
    const variant = this.variant;
    // Buscamos cuánto hay en el carrito para este producto
    const cartQty = this.cart.cartItems().find(i => i.variantId === variant?.id)?.quantity || 0;
    // Si no hay nada, calculamos para 1. Si hay algo, para esa cantidad.
    const qtyToCalculate = Math.max(1, cartQty);
    
    return this.priceService.calculatePrice(
      variant?.cost_usd, 
      qtyToCalculate, 
      this.cart.dolarOficial()
    );
  });

  get mainImage(): string {
    return this.product.images?.[0]?.url ?? '';
  }

  get variant(): ProductVariant | null {
    return this.product.variants?.[0] ?? null;
  }

  get inStock(): boolean {
    return (this.variant?.stock ?? 0) > 0;
  }

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.variant || !this.inStock) return;

    const pricing = this.currentPricing();

    this.cart.add({
      variantId: this.variant.id,
      productId: this.product.id,
      productName: this.product.name,
      slug: this.product.slug,
      sku: this.variant.sku,
      price_ars: pricing.finalPriceArs,
      price_usd: pricing.finalPriceUsd,
      cost_usd: this.variant.cost_usd,
      quantity: 1,
      imageUrl: this.mainImage,
      stock: this.variant.stock,
      units_per_pack: this.variant.units_per_pack,
      volume_cc: this.variant.dimensions?.volume_cc
    });

    this.added = true;
    setTimeout(() => this.added = false, 1800);
  }
}


