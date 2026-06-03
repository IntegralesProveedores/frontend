import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-cart-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="row g-5">
      <!-- Items List Skeleton -->
      <div class="col-lg-8">
        <div class="d-flex justify-content-between align-items-end mb-4 border-bottom pb-3">
          <app-skeleton width="200px" height="2rem" />
          <app-skeleton width="80px" height="1.5rem" />
        </div>

        @for (i of [1,2,3]; track i) {
          <div class="py-4 border-bottom">
            <div class="row align-items-center g-4">
              <div class="col-3 col-md-2">
                <app-skeleton height="0" [style.padding-bottom.%]="100" radius="var(--radius-sm)" />
              </div>
              <div class="col-9 col-md-4">
                <app-skeleton width="40%" height="0.65rem" class="d-block mb-2" />
                <app-skeleton width="80%" height="1.2rem" class="d-block mb-2" />
                <app-skeleton width="60%" height="0.8rem" />
              </div>
              <div class="col-6 col-md-3">
                <app-skeleton height="3rem" radius="var(--radius-full)" />
              </div>
              <div class="col-5 col-md-2">
                <app-skeleton width="100%" height="1.5rem" class="mb-2" />
                <app-skeleton width="60%" height="0.8rem" class="ms-auto" />
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Summary Skeleton -->
      <div class="col-lg-4">
        <div class="p-5 bg-light rounded-4">
          <app-skeleton width="100px" height="1.8rem" class="mb-5" />
          
          <div class="mb-5">
            @for (j of [1,2,3]; track j) {
              <div class="d-flex justify-content-between mb-3">
                <app-skeleton width="40%" height="1rem" />
                <app-skeleton width="30%" height="1rem" />
              </div>
            }
          </div>

          <div class="mb-5 pt-3 border-top">
            <div class="d-flex justify-content-between align-items-end">
              <app-skeleton width="40%" height="1.2rem" />
              <div class="w-50">
                <app-skeleton width="100%" height="2rem" class="mb-2" />
                <app-skeleton width="60%" height="1.2rem" class="ms-auto" />
              </div>
            </div>
          </div>

          <app-skeleton width="100%" height="3.5rem" radius="var(--radius-sm)" />
        </div>
      </div>
    </div>
  `
})
export class CartSkeletonComponent {}
