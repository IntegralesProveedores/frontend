import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-cart-icon',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-icon.component.html',
  styleUrl: './cart-icon.component.css'

})
export class CartIconComponent {
  constructor(public cart: CartService) {}
}


