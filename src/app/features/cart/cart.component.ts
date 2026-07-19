import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { CartSkeletonComponent } from '../../shared/components/cart-skeleton/cart-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CartItem } from '../../core/models/cart.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe, CartSkeletonComponent, EmptyStateComponent, ProductCardComponent, ProductCardSkeletonComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  public readonly cartService = inject(CartService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);

  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  loading = signal(false);

  // Mapeo de signals del servicio para acceso directo en template
  items = this.cartService.cartItems;
  isEmpty = this.cartService.isEmpty;
  totalUsd = this.cartService.totalUsd;
  subtotalArs = this.cartService.subtotalArs;
  totalVolume = this.cartService.totalVolumeCc;
  dolarOficial = this.cartService.dolarOficial;

  ngOnInit(): void {
    this.productsService.getProducts().subscribe({
      error: error => console.error('Error al cargar otros productos:', error)
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Incrementa la cantidad de un ítem en el carrito
  // POR QUÉ:  Usa tipo any para el parámetro item por instrucción de corrección del compilador
  // CUIDADO:  No posee tipado estático estricto para el ítem
  // ─────────────────────────────────────────────────────────────
  increment(item: CartItem): void {
    this.cartService.updateQuantity(item.variantId, item.quantity + 1);
  }

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Decrementa la cantidad de un ítem en el carrito
  // POR QUÉ:  Usa tipo any para el parámetro item por instrucción de corrección del compilador
  // CUIDADO:  No posee tipado estático estricto para el ítem
  // ─────────────────────────────────────────────────────────────
  decrement(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.variantId, item.quantity - 1);
    } else {
      this.remove(item.variantId);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Actualiza la cantidad de un ítem basado en un input numérico directo
  // POR QUÉ:  Usa tipo any para el parámetro item por instrucción de corrección del compilador
  // CUIDADO:  No posee tipado estático estricto para el ítem
  // ─────────────────────────────────────────────────────────────
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

  goToCheckout(): void {
    this.router.navigate(['/finalizar-compra']);
  }
}



