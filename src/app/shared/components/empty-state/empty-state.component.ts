import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="empty-state-canvas animate-fade">
      <div class="empty-icon-box mb-8">
        <div
          class="icon-circle mx-auto"
          [class.error-variant]="variant === 'error'"
        >
          <i class="bi {{ icon }}"></i>
        </div>
      </div>

      <h3>{{ title }}</h3>
      <p>
        {{ message }}
      </p>

      <div class="empty-actions">
        @if (actionLink) {
          <a [routerLink]="actionLink" class="button-primary">
            {{ actionText }}
          </a>
        } @else if (showAction) {
          <button (click)="actionClick.emit()">
            {{ actionText }}
          </button>
        }

        @if (secondaryActionLink) {
          <a [routerLink]="secondaryActionLink" class="button-ghost mt-4">
            {{ secondaryActionText }}
          </a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .empty-state-canvas {
        width: 100%;
        background-color: var(--color-bg-secondary);
        padding: var(--space-20) var(--space-6);
        border-radius: var(--radius-2xl);
        text-align: center;
        border: 1px solid var(--color-border-primary);
      }

      .icon-circle {
        width: 64px;
        height: 64px;
        background-color: var(--color-accent-soft);
        color: var(--color-primary);
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        border: 1px solid var(--color-border-primary);
      }

      .icon-circle.error-variant {
        background-color: rgba(239, 68, 68, 0.05);
        color: #ef4444;
      }

      .empty-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
      }

      h3 {
        margin-bottom: 1.5rem;
        color: var(--color-text-primary);
      }

      p {
        max-width: 400px;
        margin-inline: auto;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon: string = 'bi-folder2-open';
  @Input() title: string = 'No encontramos resultados';
  @Input() message: string =
    'Parece que no hay información disponible en este momento.';
  @Input() variant: 'default' | 'error' = 'default';

  @Input() showAction: boolean = false;
  @Input() actionText: string = 'Volver al Inicio';
  @Input() actionLink?: string;
  @Output() actionClick = new EventEmitter<void>();

  @Input() secondaryActionText?: string;
  @Input() secondaryActionLink?: string;
}
