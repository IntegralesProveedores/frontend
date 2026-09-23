import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Genera y persiste (sessionStorage) una idempotency_key por
//           intento de compra, para que el backend pueda reconocer un
//           reintento (doble click, recarga, red) y no duplicar la orden.
// POR QUÉ:  Se limpia recién cuando la orden se concreta (o el cliente
//           vuelve de Mercado Pago), así una recarga a mitad de un intento
//           reutiliza la misma key en vez de generar una orden nueva.
// ─────────────────────────────────────────────────────────────

const IDEMPOTENCY_KEY_STORAGE = 'checkout_idempotency_key';

@Injectable({ providedIn: 'root' })
export class CheckoutAttemptService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private key: string | null = null;

  getOrCreateKey(): string {
    if (this.key) return this.key;

    if (this.isBrowser) {
      const stored = sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
      if (stored) {
        this.key = stored;
        return stored;
      }
    }

    const fresh = crypto.randomUUID();
    this.key = fresh;
    if (this.isBrowser) sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh);
    return fresh;
  }

  clear(): void {
    this.key = null;
    if (this.isBrowser) sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
  }
}
