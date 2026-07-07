import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  template: `
    <app-empty-state 
      icon="bi-exclamation-triangle-fill"
      variant="error"
      [title]="title"
      [message]="message"
      [showAction]="showRetry"
      actionText="Intentar de nuevo"
      (actionClick)="retry.emit()"
    />
  `
})
export class ErrorStateComponent {
  @Input() title: string = '¡Ups! Algo salió mal';
  @Input() message: string = 'No pudimos conectar con el servidor. Por favor, intentá de nuevo.';
  @Input() showRetry: boolean = true;
  @Output() retry = new EventEmitter<void>();
}
