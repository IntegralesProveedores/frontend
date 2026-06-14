import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="card-skeleton h-100">
      <!-- Image area -->
      <div class="mb-3 mt-3">
        <app-skeleton height="200px" radius="var(--radius-md)" class="d-block" />
      </div>
      
      <!-- Content area -->
      <div class="product-info">
        <!-- Title -->
        <app-skeleton width="85%" height="1.125rem" class="d-block mb-3" />
        
        <!-- Price main -->
        <app-skeleton width="50%" height="1.25rem" class="d-block mb-2" />
        
        <!-- Price detail -->
        <app-skeleton width="40%" height="0.875rem" class="d-block mb-2" />
        
        <!-- IVA legend -->
        <app-skeleton width="30%" height="0.7rem" class="d-block" />
      </div>
    </div>
  `,
  styles: [`
    .card-skeleton {
      display: flex;
      flex-direction: column;
    }
  `]
})

export class ProductCardSkeletonComponent {}
