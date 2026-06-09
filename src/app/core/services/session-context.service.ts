import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** 
 * Tipos de inquilinos soportados por la plataforma.
 * 'integrales' es el tenant por defecto.
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
  taxId: string; // CUIT/CUIL
  taxCondition: string;
}

@Injectable({ providedIn: 'root' })
export class SessionContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  
  /** ID de la tienda actual resuelto por el Hostname */
  readonly tenantId = signal<TenantId>('integrales');
  
  /** Tipo de cliente actual (afecta markups en backend) */
  readonly customerType = signal<CustomerType>('minorista');
  
  /** Usuario actualmente logueado (null si es invitado) */
  readonly currentUser = signal<UserContext | null>(null);

  // ─────────────────────────────────────────────────────────────
  // DERIVACIONES (Computed)
  // ─────────────────────────────────────────────────────────────
  
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  
  readonly isBrotalia = computed(() => this.tenantId() === 'brotalia');

  constructor() {
    this.resolveTenant();
    // Simulación de login de mayorista para testing de inyección en checkout
    // Comentar esta línea para probar flujo anónimo
    // this.mockMayoristaLogin();
  }

  /**
   * Resuelve el tenant basándose en el dominio actual.
   * SSR-Safe: Solo intenta acceder a window/document si está en el browser.
   */
  private resolveTenant(): void {
    if (this.isBrowser) {
      const hostname = window.location.hostname;
      if (hostname.includes('brotalia')) {
        this.tenantId.set('brotalia');
        document.body.classList.add('theme-brotalia');
        document.title = 'Brotalia';
      } else {
        this.tenantId.set('integrales');
        document.title = 'Integrales Proveedores';
      }
    }
  }

  /**
   * Simula la carga de datos de un cliente mayorista desde Supabase Auth.
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
