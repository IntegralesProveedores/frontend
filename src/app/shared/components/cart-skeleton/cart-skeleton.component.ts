import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-cart-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="row g-5">
      <div class="col-lg-8">
        @for (i of [1,2,3]; track i) {
          <div class="cart-item-row py-2 border-bottom">
            <div class="row align-items-center g-3">
              <div class="col-4 col-md-5">
                <div class="d-flex align-items-center gap-3">
                  <div class="cart-img-box">
                    <app-skeleton width="100%" height="100px" radius="var(--radius-sm)" />
                  </div>
                  <div class="cart-item-info">
                    <app-skeleton width="85%" height="1rem" class="d-block mb-2" />
                    <app-skeleton width="55%" height="0.7rem" class="d-block mb-2" />
                    <app-skeleton width="50%" height="0.7rem" class="d-block mb-2" />
                    <app-skeleton width="45%" height="0.65rem" class="d-block" />
                  </div>
                </div>
              </div>

              <div class="col-7 col-md-6">
                <div class="d-flex justify-content-between align-items-center">
                  <app-skeleton width="115px" height="2.25rem" radius="var(--radius-full)" />
                  <div class="item-total">
                    <app-skeleton width="90px" height="0.9rem" class="d-block mb-2" />
                    <app-skeleton width="75px" height="0.7rem" class="d-block mb-2 ms-auto" />
                    <app-skeleton width="45px" height="0.65rem" class="d-block ms-auto" />
                  </div>
                </div>
              </div>

              <div class="col-1 col-md-1 text-end">
                <app-skeleton width="28px" height="28px" radius="var(--radius-sm)" />
              </div>
            </div>
          </div>
        }
      </div>

      <div class="col-lg-4">
        <div class="order-summary-box p-4">
          <app-skeleton width="180px" height="1.25rem" class="d-block mb-4" />

          <div class="summary-row d-flex justify-content-between mb-3">
            <app-skeleton width="100px" height="0.8rem" />
            <app-skeleton width="70px" height="0.8rem" />
          </div>

          <div class="summary-row d-flex justify-content-between mb-3 border-bottom pb-3">
            <app-skeleton width="100px" height="0.8rem" />
            <app-skeleton width="70px" height="0.8rem" />
          </div>

          <div class="total-row d-flex justify-content-between align-items-start pt-3 mt-2">
            <app-skeleton width="70px" height="1.25rem" />
            <div class="text-end">
              <app-skeleton width="145px" height="2rem" class="d-block mb-2" />
              <app-skeleton width="100px" height="1.25rem" class="d-block mb-2 ms-auto" />
              <app-skeleton width="115px" height="0.7rem" class="d-block ms-auto" />
            </div>
          </div>

          <div class="summary-actions mt-4">
            <app-skeleton width="100%" height="52px" radius="var(--radius-base)" class="d-block mb-3" />
            <app-skeleton width="100%" height="52px" radius="var(--radius-base)" class="d-block" />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cart-img-box {
      width: 100px;
      flex: 0 0 100px;
    }

    .cart-item-info {
      min-width: 0;
      flex: 1;
    }

    .item-total {
      min-width: 110px;
      text-align: right;
    }

    .order-summary-box {
      background-color: var(--color-bg-soft);
      border-radius: var(--border-radius-base);
    }

    @media (max-width: 1000px) {
      .cart-img-box {
        display: none;
      }
    }
  `]
})
export class CartSkeletonComponent {}
