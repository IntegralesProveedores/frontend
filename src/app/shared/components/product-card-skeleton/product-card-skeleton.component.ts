import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="card-skeleton">
      <!-- Image area 1:1 -->
      <app-skeleton height="0" [style.padding-bottom.%]="100" radius="var(--int-radius-lg)" class="d-block mb-3" />
      
      <!-- Content area left-aligned -->
      <div class="px-2">
        <!-- Category -->
        <app-skeleton width="30%" height="0.625rem" class="d-block mb-2" />
        <!-- Title -->
        <app-skeleton width="90%" height="0.875rem" class="d-block mb-2" />
        <app-skeleton width="60%" height="0.875rem" class="d-block mb-4" />
        
        <!-- Price -->
        <div class="d-flex align-items-baseline gap-2">
          <app-skeleton width="40%" height="1.25rem" />
          <app-skeleton width="20%" height="0.75rem" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card-skeleton {
      height: 100%;
      overflow: hidden;
    }
  `]
})

export class ProductCardSkeletonComponent {}
