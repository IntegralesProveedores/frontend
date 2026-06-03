import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-detail-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="row g-5 align-items-start animate-fade">
      <!-- Left: Gallery Skeleton -->
      <div class="col-lg-6">
        <app-skeleton height="0" [style.padding-bottom.%]="100" radius="var(--int-radius-lg)" class="d-block mb-4" />
        <div class="d-flex gap-3">
          @for (i of [1,2,3]; track i) {
            <app-skeleton width="80px" height="80px" radius="var(--int-radius-md)" />
          }
        </div>
      </div>

      <!-- Right: Info Skeleton -->
      <div class="col-lg-5 offset-lg-1">
        <app-skeleton width="25%" height="0.625rem" class="d-block mb-4" />
        <app-skeleton width="80%" height="2.5rem" class="d-block mb-4" />
        <app-skeleton width="100%" height="1rem" class="d-block mb-2" />
        <app-skeleton width="100%" height="1rem" class="d-block mb-2" />
        <app-skeleton width="60%" height="1rem" class="d-block mb-5" />

        <!-- Pricing Card Skeleton -->
        <div class="p-6 bg-off-white rounded-lg mb-5 border-subtle">
          <div class="d-flex justify-content-between align-items-end">
            <div class="w-100">
              <app-skeleton width="20%" height="0.625rem" class="d-block mb-2" />
              <app-skeleton width="50%" height="2.25rem" />
            </div>
            <app-skeleton width="80px" height="1.5rem" radius="var(--int-radius-xs)" />
          </div>
        </div>

        <!-- Variants -->
        <app-skeleton width="30%" height="0.625rem" class="d-block mb-3" />
        <div class="d-flex gap-2 mb-5">
          @for (i of [1,2,3]; track i) {
            <app-skeleton width="100px" height="2.25rem" radius="var(--int-radius-full)" />
          }
        </div>

        <!-- Quantity -->
        <app-skeleton width="20%" height="0.625rem" class="d-block mb-3" />
        <app-skeleton width="140px" height="2.5rem" radius="var(--int-radius-full)" class="d-block mb-5" />

        <!-- CTA -->
        <app-skeleton width="100%" height="3.5rem" radius="var(--int-radius-md)" class="d-block mb-5" />
        
        <div class="d-flex justify-content-center gap-5">
          <div class="d-flex flex-column align-items-center gap-2">
            <app-skeleton width="32px" height="32px" radius="50%" />
            <app-skeleton width="60px" height="0.5rem" />
          </div>
          <div class="d-flex flex-column align-items-center gap-2">
            <app-skeleton width="32px" height="32px" radius="50%" />
            <app-skeleton width="60px" height="0.5rem" />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bg-off-white { background-color: var(--int-color-off-white); }
    .border-subtle { border: 1px solid var(--int-border-subtle); }
    .rounded-lg { border-radius: var(--int-radius-lg); }
    .p-6 { padding: var(--int-space-6); }
  `]
})

export class ProductDetailSkeletonComponent {}
