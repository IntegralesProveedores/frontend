import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type PaymentMethodValue = 'mercadopago' | 'transferencia';

const PAYMENT_KEY = 'checkout_payment_method_draft';

@Injectable({ providedIn: 'root' })
export class PaymentMethodService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly method = signal<PaymentMethodValue | null>('mercadopago');

  readonly current = this.method.asReadonly();

  constructor() {
    if (this.isBrowser) this.loadFromStorage();
  }

  setMethod(method: PaymentMethodValue): void {
    this.method.set(method);
    if (this.isBrowser) localStorage.setItem(PAYMENT_KEY, method);
  }

  clear(): void {
    this.method.set('mercadopago');
    if (this.isBrowser) localStorage.removeItem(PAYMENT_KEY);
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem(PAYMENT_KEY);
    if (saved === 'mercadopago' || saved === 'transferencia') {
      this.method.set(saved);
    }
  }
}
