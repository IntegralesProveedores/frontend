import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface CreatePaymentPayload {
  order_id: string;
  provider: 'mercadopago';
}

export interface PaymentResponse {
  checkout_url: string;
  preference_id: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private api: ApiService) {}

  createPayment(payload: CreatePaymentPayload) {
    return this.api.post<PaymentResponse>('/payments/create', payload);
  }
}


