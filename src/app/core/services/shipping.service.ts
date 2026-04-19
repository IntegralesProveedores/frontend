import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ShippingAddress, ShippingOption } from '../models/order.model';

export interface ShippingQuotePayload {
  postal_code: string;
  items: { variant_id: string; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class ShippingService {
  constructor(private api: ApiService) {}

  getQuote(payload: ShippingQuotePayload) {
    return this.api.post<ShippingOption[]>('/shipping-quote', payload);
  }
}


