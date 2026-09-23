import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, firstValueFrom, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  OrderPaymentState,
} from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class MercadoPagoService {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async startCheckout(request: CreatePaymentRequest): Promise<void> {
    const response = await firstValueFrom(
      this.api.post<CreatePaymentResponse>('/payments/create', request),
    );

    if (!this.isBrowser || !response.init_point) {
      throw new Error('Mercado Pago checkout URL is unavailable');
    }

    let checkoutUrl: URL;
    try {
      checkoutUrl = new URL(response.init_point);
    } catch {
      throw new Error('Mercado Pago checkout URL is invalid');
    }
    const allowedHost = /(^|\.)mercadopago\.com(\.ar)?$/i;
    if (checkoutUrl.protocol !== 'https:' || !allowedHost.test(checkoutUrl.hostname)) {
      throw new Error('Unexpected Mercado Pago checkout host');
    }

    window.location.assign(checkoutUrl.toString());
  }

  /** Estado real del pago según el backend (lo actualiza el webhook de Mercado Pago). */
  getPaymentState(externalReference: string): Observable<OrderPaymentState> {
    return this.api
      .get<{ payment: OrderPaymentState }>(
        `/orders/status/${encodeURIComponent(externalReference)}`,
      )
      .pipe(map((response) => response.payment));
  }
}
