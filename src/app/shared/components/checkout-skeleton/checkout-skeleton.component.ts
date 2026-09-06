import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-checkout-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  templateUrl: './checkout-skeleton.component.html',
  styleUrl: './checkout-skeleton.component.css',
})
export class CheckoutSkeletonComponent {}
