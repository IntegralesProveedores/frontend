import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartIconComponent } from '../cart-icon/cart-icon.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CartIconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private readonly platformId = inject(PLATFORM_ID);

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  /** 
   * Realiza un scroll suave hacia una sección de la página.
   * CUIDADO: SSR-Safe check obligatorio antes de acceder a 'document'.
   */
  scrollToSection(id: string) {
    if (!isPlatformBrowser(this.platformId)) return;

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}