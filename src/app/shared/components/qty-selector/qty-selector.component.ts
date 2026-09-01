import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qty-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qty-selector.component.html',
  styleUrl: './qty-selector.component.css',
})
export class QtySelectorComponent {
  @Input() quantity = 1;
  /** 'cart' = igual que antes en cart (qty-selector-minimal, botones chicos, nunca deshabilitados).
   *  'detail' = igual que antes en product-detail (qty-selector, botones normales, con límites). */
  @Input() variant: 'cart' | 'detail' = 'detail';
  @Input() decrementDisabled = false;
  @Input() incrementDisabled = false;

  @Output() decrement = new EventEmitter<void>();
  @Output() increment = new EventEmitter<void>();
}
