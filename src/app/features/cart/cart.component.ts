import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CartItem } from '../../core/models/cart.model';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyArsPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent {
  constructor(
    public cartService: CartService,
    private router: Router
  ) {}

  // Getters reactivos desde el servicio
  items = this.cartService.cartItems;
  isEmpty = this.cartService.isEmpty;
  totalUsd = this.cartService.totalUsd;
  totalArs = this.cartService.subtotalArs;
  totalVolume = this.cartService.totalVolumeCc;
  dolarOficial = this.cartService.dolarOficial;

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

  onQuantityInput(item: CartItem, event: any): void {
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

  // Formateadores locales (estilo antiguo)
  fmtNumber(n: number) {
    return new Intl.NumberFormat('es-AR').format(n || 0);
  }
}


