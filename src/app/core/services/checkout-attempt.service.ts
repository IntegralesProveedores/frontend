import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Genera y persiste (sessionStorage) una idempotency_key por
//           intento de compra, para que el backend pueda reconocer un
//           reintento (doble click, recarga, red) y no duplicar la orden.
// POR QUÉ:  Se limpia recién cuando la orden se concreta (o el cliente
//           vuelve de Mercado Pago), así una recarga a mitad de un intento
//           reutiliza la misma key en vez de generar una orden nueva.
// CUIDADO:  La key va atada al contenido del pedido (`fingerprint`): si el
//           cliente cambia el carrito, el envío, el medio de pago o sus datos,
//           es otro intento y lleva key nueva. Si no, el backend reusaría la
//           orden anterior (con los ítems viejos) o la rechazaría si ya estaba
//           cancelada.
// ─────────────────────────────────────────────────────────────

const IDEMPOTENCY_KEY_STORAGE = 'checkout_idempotency_key';

interface StoredAttempt {
  key: string;
  fingerprint: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutAttemptService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private attempt: StoredAttempt | null = null;

  getOrCreateKey(fingerprint: string): string {
    const current = this.attempt ?? this.readStored();
    if (current?.fingerprint === fingerprint) {
      this.attempt = current;
      return current.key;
    }

    this.attempt = { key: crypto.randomUUID(), fingerprint };
    if (this.isBrowser)
      sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, JSON.stringify(this.attempt));
    return this.attempt.key;
  }

  clear(): void {
    this.attempt = null;
    if (this.isBrowser) sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
  }

  private readStored(): StoredAttempt | null {
    if (!this.isBrowser) return null;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE) ?? 'null');
      return typeof parsed?.key === 'string' && typeof parsed?.fingerprint === 'string'
        ? parsed
        : null;
    } catch {
      // Formato viejo (la key sola, sin fingerprint): se descarta.
      return null;
    }
  }
}
