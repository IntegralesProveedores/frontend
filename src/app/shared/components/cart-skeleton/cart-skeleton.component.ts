import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-cart-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="row">
      <div class="offset-lg-1 col-lg-5">
        @for (i of [1, 2, 3]; track i) {
          <div class="cart-item-row py-2 border-bottom">
            <div class="row align-items-center g-1">
              <div class="col-2 col-md-2">
                <app-skeleton
                  width="100%"
                  height="56px"
                  radius="var(--radius-sm)"
                />
              </div>

              <div class="col-3 col-md-3">
                <app-skeleton width="85%" height="0.9rem" class="d-block mb-2" />
                <app-skeleton width="55%" height="0.65rem" class="d-block mb-2" />
                <app-skeleton width="45%" height="0.65rem" class="d-block" />
              </div>

              <div class="col-4 col-md-3">
                <app-skeleton
                  width="115px"
                  height="2.25rem"
                  radius="var(--radius-full)"
                />
              </div>

              <div class="col-2 col-md-3 text-end">
                <app-skeleton width="70%" height="0.9rem" class="d-block mb-2 ms-auto" />
                <app-skeleton width="50%" height="0.65rem" class="d-block ms-auto" />
              </div>

              <div class="col-1 col-md-1 text-end">
                <app-skeleton width="20px" height="20px" radius="var(--radius-sm)" />
              </div>
            </div>
          </div>
        }
      </div>

      <div class="offset-lg-1 col-lg-4">
        <div class="order-summary-box p-3">
          <div class="summary-row d-flex justify-content-between align-items-start mb-3">
            <app-skeleton width="80px" height="1.1rem" />
            <div class="text-end">
              <app-skeleton width="110px" height="1.5rem" class="d-block mb-2" />
              <app-skeleton width="90px" height="0.7rem" class="d-block ms-auto" />
            </div>
          </div>

          <div class="shipping-options-row d-flex gap-2 mb-3">
            @for (i of [1, 2, 3]; track i) {
              <app-skeleton width="100%" height="52px" radius="var(--radius-md)" />
            }
          </div>
          <div class="d-flex gap-2 mb-3">
            <app-skeleton width="30%" height="2.25rem" radius="var(--radius-sm)" />
            <app-skeleton width="68%" height="2.25rem" radius="var(--radius-sm)" />
          </div>

          <div class="total-row d-flex justify-content-between align-items-start pt-3 border-top">
            <app-skeleton width="70px" height="1.1rem" />
            <div class="text-end">
              <app-skeleton width="120px" height="1.75rem" class="d-block mb-2 ms-auto" />
              <app-skeleton width="90px" height="0.7rem" class="d-block ms-auto" />
            </div>
          </div>

          <app-skeleton
            width="100%"
            height="52px"
            radius="var(--radius-base)"
            class="d-block mt-3"
          />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .order-summary-box {
        background-color: var(--color-bg-soft);
        border-radius: var(--border-radius-base);
      }
    `,
  ],
})
export class CartSkeletonComponent {}
