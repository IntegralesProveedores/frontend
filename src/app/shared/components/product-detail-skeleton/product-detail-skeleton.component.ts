import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-detail-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="row g-5">
      <!-- Left: Image Skeleton -->
      <div class="col-md-6">
        <app-skeleton height="500px" radius="var(--radius-md)" class="d-block mb-3" />
      </div>

      <!-- Right: Info Skeleton -->
      <div class="col-md-5">
        <div class="product-header mb-4">
          <!-- Breadcrumb -->
          <app-skeleton width="40%" height="0.75rem" class="d-block mb-3" />
          <!-- Title -->
          <app-skeleton width="80%" height="2rem" class="d-block mb-3" />
          <!-- Description -->
          <app-skeleton width="100%" height="0.875rem" class="d-block mb-2" />
          <app-skeleton width="90%" height="0.875rem" class="d-block" />
        </div>

        <div class="mb-5 py-4 border-top border-bottom">
          <!-- Price Main -->
          <app-skeleton width="45%" height="2rem" class="d-block mb-2" />
          <!-- Price Detail -->
          <app-skeleton width="35%" height="1.125rem" class="d-block mb-2" />
          <!-- IVA Legend -->
          <app-skeleton width="20%" height="0.8rem" class="d-block" />
        </div>

        <!-- Variants Skeleton -->
        <div class="mb-4">
          <app-skeleton width="30%" height="0.75rem" class="d-block mb-3" />
          <div class="d-flex gap-2">
            @for (i of [1,2,3]; track i) {
              <app-skeleton width="80px" height="2.25rem" radius="var(--radius-sm)" />
            }
          </div>
        </div>

        <!-- Quantity Skeleton -->
        <div class="mb-5">
          <app-skeleton width="20%" height="0.75rem" class="d-block mb-3" />
          <app-skeleton width="140px" height="2.5rem" radius="var(--radius-sm)" />
        </div>

        <!-- CTA Skeleton -->
        <div class="actions-wrapper">
          <app-skeleton width="100%" height="3.5rem" radius="var(--radius-sm)" class="d-block mb-3" />
          <app-skeleton width="60%" height="0.75rem" class="d-block mx-auto" />
        </div>
      </div>
    </div>
  `,
  styles: []
})

export class ProductDetailSkeletonComponent {}
