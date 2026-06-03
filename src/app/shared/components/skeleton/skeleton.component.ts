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
    .skeleton-base {
      background-color: var(--color-bg-tertiary);
      background: linear-gradient(
        90deg, 
        rgba(150, 150, 150, 0.05) 25%, 
        rgba(150, 150, 150, 0.1) 37%, 
        rgba(150, 150, 150, 0.05) 63%
      );
      background-size: 400% 100%;
      display: inline-block;
      width: 100%;
    }


    .circle {
      border-radius: 50% !important;
    }

    .animate-shimmer {
      animation: shimmer 1.4s ease infinite;
    }

    @keyframes shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `]
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() radius: string = 'var(--radius-sm)';
  @Input() variant: 'rect' | 'circle' = 'rect';
}
