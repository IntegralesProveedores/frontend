import { OrderItem, ShippingPayload } from './order.model';

export interface MercadoPagoCustomer {
  nombre: string;
  email: string;
  cuit: string;
  codigoArea: string;
  celular: string;
}

export interface CreatePaymentRequest {
  items: OrderItem[];
  customer: MercadoPagoCustomer;
  shipping: ShippingPayload;
}

export interface CreatePaymentResponse {
  init_point: string;
}
