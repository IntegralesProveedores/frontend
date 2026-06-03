import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="empty-state-canvas animate-fade" [class.surface-secondary]="withBackground">
      <div class="empty-icon-box mb-8">
        <div class="icon-circle mx-auto" [class.error-variant]="variant === 'error'">
          <i class="fa-solid {{ icon }}"></i>
        </div>
      </div>
      
      <h3 class="text-editorial-md mb-4 empty-title">{{ title }}</h3>
      <p class="empty-message mb-10 mx-auto max-w-400">
        {{ message }}
      </p>


      <div class="empty-actions">
        @if (actionLink) {
          <a [routerLink]="actionLink" class="button-primary">
            {{ actionText }}
          </a>
        } @else if (showAction) {
          <button (click)="actionClick.emit()" class="button-primary">
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
  styles: [`
    .empty-state-canvas {
      width: 100%;
      padding: var(--space-20) var(--space-6);
      border-radius: var(--radius-2xl);
      text-align: center;
      border: 1px solid var(--color-border-primary);
    }
    
    .icon-circle {
      width: 64px;
      height: 64px;
      background-color: var(--color-brand-faded);
      color: var(--color-brand-primary);
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

    .empty-title {
      color: var(--color-text-primary);
    }

    .empty-message {
      color: var(--color-text-secondary);
    }

    .max-w-400 { max-width: 400px; }

  `]
})
export class EmptyStateComponent {
  @Input() icon: string = 'fa-folder-open';
  @Input() title: string = 'No encontramos resultados';
  @Input() message: string = 'Parece que no hay información disponible en este momento.';
  @Input() variant: 'default' | 'error' = 'default';
  @Input() withBackground: boolean = true;
  
  @Input() showAction: boolean = false;
  @Input() actionText: string = 'Volver al Inicio';
  @Input() actionLink?: string;
  @Output() actionClick = new EventEmitter<void>();

  @Input() secondaryActionText?: string;
  @Input() secondaryActionLink?: string;
}
