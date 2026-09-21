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
  payment_method?: 'mercadopago' | 'transferencia';
  /** Total que el cliente vio en pantalla; el backend rechaza (409) si cambió. */
  expected_total_ars?: number;
  turnstile_token?: string;
}

export interface CreatePaymentResponse {
  init_point: string;
}
