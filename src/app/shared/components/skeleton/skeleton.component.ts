import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="skeleton-base animate-shimmer" 
      [style.width]="width" 
      [style.height]="height"
      [style.border-radius]="radius"
      [class.circle]="variant === 'circle'"
    ></div>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 100%;
      vertical-align: middle;
    }

    .skeleton-base {
      width: 100%;
      height: 100%;
      background-color: var(--color-bg-tertiary);
      background-image: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0,
        rgba(255, 255, 255, 0.05) 20%,
        rgba(255, 255, 255, 0.1) 50%,
        rgba(255, 255, 255, 0.05) 80%,
        rgba(255, 255, 255, 0) 100%
      );
      background-size: 200% 100%;
      display: block;
      position: relative;
      overflow: hidden;
    }

    /* Light mode specific adjustment if needed */
    :root[data-theme='light'] .skeleton-base {
       background-image: linear-gradient(
        90deg,
        rgba(0, 0, 0, 0) 0,
        rgba(0, 0, 0, 0.03) 20%,
        rgba(0, 0, 0, 0.05) 50%,
        rgba(0, 0, 0, 0.03) 80%,
        rgba(0, 0, 0, 0) 100%
      );
    }

    .circle {
      border-radius: 50% !important;
    }

    .animate-shimmer {
      animation: shimmer 1.5s infinite linear;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `]
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() radius: string = 'var(--radius-sm)';
  @Input() variant: 'rect' | 'circle' = 'rect';
}
