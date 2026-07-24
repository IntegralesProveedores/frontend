import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { OrderDetail } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);

  /** Carga una orden completa para el futuro detalle de /orden/:id. */
  getOrderDetail(id: string) {
    return this.api.get<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  }
}
