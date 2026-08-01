import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CustomerDraft {
  nombre: string;
  email: string;
  cuit: string;
  codigoArea: string;
  celular: string;
}

const CUSTOMER_DRAFT_KEY = 'checkout_customer_draft';
const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  nombre: '',
  email: '',
  cuit: '',
  codigoArea: '',
  celular: ''
};

@Injectable({ providedIn: 'root' })
export class CustomerDraftService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly draft = signal<CustomerDraft | null>(null);

  readonly current = this.draft.asReadonly();

  constructor() {
    if (this.isBrowser) this.loadFromStorage();
  }

  setCustomer(data: CustomerDraft): void {
    this.draft.set({ ...data });
    if (this.isBrowser) localStorage.setItem(CUSTOMER_DRAFT_KEY, JSON.stringify(this.draft()));
  }

  clear(): void {
    this.draft.set(null);
    if (this.isBrowser) localStorage.removeItem(CUSTOMER_DRAFT_KEY);
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(CUSTOMER_DRAFT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<CustomerDraft>;
      if (typeof parsed !== 'object' || parsed === null) return;

      this.draft.set({
        ...EMPTY_CUSTOMER_DRAFT,
        nombre: typeof parsed.nombre === 'string' ? parsed.nombre : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
        cuit: typeof parsed.cuit === 'string' ? parsed.cuit : '',
        codigoArea: typeof parsed.codigoArea === 'string' ? parsed.codigoArea : '',
        celular: typeof parsed.celular === 'string' ? parsed.celular : ''
      });
    } catch {
      this.draft.set(null);
    }
  }
}
