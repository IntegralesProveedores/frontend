import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CreateOrderPayload, OrderStatus } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private api: ApiService) {}

  createOrder(payload: CreateOrderPayload) {
    return this.api.post<{ order_id: string }>('/orders', payload);
  }

  getOrder(id: string) {
    return this.api.get<OrderStatus>(`/orders/${id}`);
  }
}


