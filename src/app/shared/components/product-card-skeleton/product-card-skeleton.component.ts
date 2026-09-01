import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="product-card-wrapper h-100">
      <div class="product-image-box mb-3">
        <app-skeleton width="100%" height="100%" radius="var(--radius-md)" />
      </div>

      <div class="product-info">
        <app-skeleton width="85%" height="2.25rem" class="d-block mb-2" />
        <app-skeleton width="65%" height="1.8rem" class="d-block mb-2" />
        <app-skeleton width="35%" height="0.7rem" class="d-block" />
      </div>
    </div>
  `,
  styles: [
    `
      .product-card-wrapper {
        padding: 8px;
        border-radius: var(--border-radius-base);
      }

      .product-image-box {
        aspect-ratio: 1 / 1;
        background-color: var(--color-bg-soft);
        border-radius: var(--border-radius-base);
        overflow: hidden;
      }
    `,
  ],
})
export class ProductCardSkeletonComponent {}
