import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Tipos de inquilinos soportados por la plataforma.
 */
export type TenantId = 'integrales' | 'brotalia';

/** Tipo de cliente para lógica de precios y visualización */
export type CustomerType = 'minorista' | 'mayorista';

/** Interfaz de usuario autenticado (Mock para FASE 2/3) */
export interface UserContext {
  fullName: string;
  email: string;
  phone: {
    areaCode: string;
    number: string;
  };
  taxId: string;
  taxCondition: string;
}

@Injectable({ providedIn: 'root' })
export class SessionContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ─────────────────────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────────────────────

  /** NULL hasta resolver el dominio */
  readonly tenantId = signal<TenantId | null>(null);

  /** Indica que el tenant ya fue resuelto */
  readonly tenantResolved = signal(false);

  /** Tipo de cliente actual */
  readonly customerType = signal<CustomerType>('minorista');

  /** Usuario actual */
  readonly currentUser = signal<UserContext | null>(null);

  // ─────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────

  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  readonly isBrotalia = computed(
    () => this.tenantId() === 'brotalia'
  );

  constructor() {
    this.resolveTenant();
    // this.mockMayoristaLogin();
  }

  /**
   * Resuelve tenant según hostname.
   */
  private resolveTenant(): void {
    if (this.isBrowser) {
      const hostname = window.location.hostname.toLowerCase();

      if (hostname.includes('brotalia')) {
        this.tenantId.set('brotalia');

        document.body.classList.add('theme-brotalia');
        document.title = 'Brotalia';
      } else {
        this.tenantId.set('integrales');

        document.title = 'Integrales Proveedores';
      }
    } else {
      this.tenantId.set('integrales');
    }

    this.tenantResolved.set(true);
  }

  /**
   * Simulación de cliente mayorista.
   */
  private mockMayoristaLogin(): void {
    this.customerType.set('mayorista');

    this.currentUser.set({
      fullName: 'Distribuidora Patagonia S.A.',
      email: 'ventas@patagonia.com',
      phone: {
        areaCode: '294',
        number: '4556677'
      },
      taxId: '30-71458922-4',
      taxCondition: 'Responsable Inscripto'
    });
  }
}