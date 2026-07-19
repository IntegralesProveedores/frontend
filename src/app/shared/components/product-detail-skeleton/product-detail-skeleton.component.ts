import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-detail-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  templateUrl: './product-detail-skeleton.component.html',
  styleUrl: './product-detail-skeleton.component.css'

})

export class ProductDetailSkeletonComponent {}
