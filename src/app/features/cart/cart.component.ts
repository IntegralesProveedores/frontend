import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { CartSkeletonComponent } from '../../shared/components/cart-skeleton/cart-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CartItem } from '../../core/models/cart.model';
import { QtySelectorComponent } from '../../shared/components/qty-selector/qty-selector.component';
import { RelatedProductsComponent } from '../../shared/components/related-products/related-products.component';
import { OrderSummaryComponent } from '../../shared/components/order-summary/order-summary.component';
import { ShippingSelectorComponent } from '../../shared/components/shipping-selector/shipping-selector.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CurrencyArsPipe,
    CartSkeletonComponent,
    EmptyStateComponent,
    QtySelectorComponent,
    RelatedProductsComponent,
    OrderSummaryComponent,
    ShippingSelectorComponent,
  ],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent implements OnInit {
  public readonly cartService = inject(CartService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);

  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  loading = signal(false);

  items = computed(() =>
    [...this.cartService.cartItems()].sort(
      (a, b) =>
        (a.product_volume_cc ?? 0) - (b.product_volume_cc ?? 0) ||
        (a.units_per_pack ?? 0) - (b.units_per_pack ?? 0),
    ),
  );
  isEmpty = this.cartService.isEmpty;
  totalUsd = this.cartService.totalUsd;
  subtotalArs = this.cartService.subtotalArs;
  totalVolume = this.cartService.totalVolumeCc;
  dolarOficial = this.cartService.dolarOficial;

  ngOnInit(): void {
    this.productsService.getProducts().subscribe({
      error: (error) =>
        console.error('Error al cargar otros productos:', error),
    });
  }

  increment(item: CartItem): void {
    this.cartService.updateQuantity(item.variantId, item.quantity + 1);
  }

  decrement(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.variantId, item.quantity - 1);
    } else {
      this.remove(item.variantId);
    }
  }

  onQuantityInput(item: CartItem, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const val = parseInt(target?.value ?? '', 10);
    if (!isNaN(val)) {
      this.cartService.updateQuantity(item.variantId, Math.max(0, val));
    }
  }

  remove(variantId: string): void {
    this.cartService.remove(variantId);
  }
}
