import { Injectable, signal, computed } from '@angular/core';

/** Interfaz de usuario autenticado */
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
  /** Usuario actual */
  readonly currentUser = signal<UserContext | null>(null);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
}
