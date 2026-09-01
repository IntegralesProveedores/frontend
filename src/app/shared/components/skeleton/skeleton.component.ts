import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.css',
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() radius: string = 'var(--radius-sm)';
  @Input() variant: 'rect' | 'circle' = 'rect';
}
