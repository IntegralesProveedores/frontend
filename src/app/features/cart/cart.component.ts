import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { CartSkeletonComponent } from '../../shared/components/cart-skeleton/cart-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyArsPipe, CartSkeletonComponent, EmptyStateComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  public readonly cartService = inject(CartService);
  private readonly router = inject(Router);

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

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Incrementa la cantidad de un ítem en el carrito
  // POR QUÉ:  Usa tipo any para el parámetro item por instrucción de corrección del compilador
  // CUIDADO:  No posee tipado estático estricto para el ítem
  // ─────────────────────────────────────────────────────────────
  increment(item: any): void {
    this.cartService.updateQuantity(item.variantId, item.quantity + 1);
  }

  // ─────────────────────────────────────────────────────────────
  // QUÉ HACE: Decrementa la cantidad de un ítem en el carrito
  // POR QUÉ:  Usa tipo any para el parámetro item por instrucción de corrección del compilador
  // CUIDADO:  No posee tipado estático estricto para el ítem
  // ─────────────────────────────────────────────────────────────
  decrement(item: any): void {
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
  onQuantityInput(item: any, event: any): void {
    const val = parseInt(event.target.value, 10);
    if (!isNaN(val)) {
      this.cartService.updateQuantity(item.variantId, Math.max(0, val));
    }
  }

  remove(variantId: string): void {
    this.cartService.remove(variantId);
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }
}



