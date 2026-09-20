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
        <app-skeleton width="50%" height="0.6rem" class="d-block mb-3" />
        <table>
          <tbody>
            @for (i of [1, 2, 3]; track i) {
              <tr>
                <td>
                  <app-skeleton width="100%" height="56px" radius="var(--border-radius-base)" />
                </td>
                <td>
                  <app-skeleton width="85%" height="0.9rem" class="d-block mb-2" />
                  <app-skeleton width="55%" height="0.65rem" class="d-block mb-1" />
                  <app-skeleton width="45%" height="0.65rem" class="d-block" />
                </td>
                <td>
                  <app-skeleton width="100%" height="36px" radius="var(--radius-full)" />
                </td>
                <td class="text-end">
                  <app-skeleton width="70%" height="0.9rem" class="d-block mb-2 ms-auto" />
                  <app-skeleton width="50%" height="0.65rem" class="d-block ms-auto" />
                </td>
                <td class="text-end">
                  <app-skeleton width="20px" height="20px" radius="var(--radius-sm)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="offset-lg-1 col-lg-4">
        <aside>
          <section>
            <div class="summary-row">
              <app-skeleton width="80px" height="1rem" />
              <div class="text-end">
                <app-skeleton width="100px" height="1.3rem" class="d-block mb-1" />
                <app-skeleton width="90px" height="0.65rem" class="d-block ms-auto" />
              </div>
            </div>
          </section>

          <section>
            <div class="shipping-options-row d-flex gap-2 mb-2">
              @for (i of [1, 2, 3]; track i) {
                <app-skeleton width="100%" height="52px" radius="var(--radius-md)" />
              }
            </div>
            <div class="summary-row mt-2">
              <app-skeleton width="70px" height="1rem" />
              <app-skeleton width="90px" height="1.3rem" />
            </div>
          </section>

          <section>
            <div class="summary-row">
              <app-skeleton width="70px" height="1rem" />
              <div class="text-end">
                <app-skeleton width="110px" height="1.5rem" class="d-block mb-1" />
                <app-skeleton width="90px" height="0.65rem" class="d-block ms-auto" />
              </div>
            </div>
          </section>

          <app-skeleton width="100%" height="52px" radius="var(--radius-full)" class="d-block mt-3" />
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      td {
        padding: 0.4rem 0.2rem;
      }

      .text-end {
        text-align: end;
      }

      aside {
        background-color: var(--color-bg-soft);
        border-radius: var(--border-radius-base);
        margin: 0;
        padding: 0;
        font-size: 1rem;
      }

      aside section {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-base);
        padding: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      @media (max-width: 991.98px) {
        .row {
          --bs-gutter-y: 1rem;
        }
      }
    `,
  ],
})
export class CartSkeletonComponent {}
