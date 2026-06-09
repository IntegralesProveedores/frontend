import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SessionContextService } from '../../../core/services/session-context.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private readonly platformId = inject(PLATFORM_ID);
  public readonly session = inject(SessionContextService);
  email = signal('');

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  /** 
   * Simula la suscripción al newsletter.
   * CUIDADO: alert() bloquea el hilo y no es SSR-safe.
   */
  subscribe() {
    if (this.email()) {
      if (isPlatformBrowser(this.platformId)) {
        alert('¡Gracias por suscribirte!');
      }
      this.email.set('');
    }
  }
}

