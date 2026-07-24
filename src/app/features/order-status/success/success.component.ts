import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './success.component.html',
  styleUrl: './success.component.css'
})

export class SuccessComponent implements OnInit {
  
  constructor(
	private readonly cartService: CartService,
    private readonly shippingService: ShippingService	
  ) {}

  ngOnInit(): void {
    this.cartService.clear();
    this.shippingService.clear();
  }
}


