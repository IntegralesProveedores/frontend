export interface ShippingAddress {
  recipient_name: string;
  postal_code: string;
  province: string;
  locality: string;
  county: string;
  street: string;
  street_number: string;
  floor: string;
  apartment: string;
  country: string;
  observations?: string;
}

export type ShippingMethod = 'pickup' | 'delivery' | 'coordinar';

export interface ShippingPayload {
  method: ShippingMethod;
  address?: ShippingAddress;
}

export interface ShippingOption {
  provider: string;
  service: string;
  price: number;
  days_min: number;
  days_max: number;
}

export interface OrderItem {
  variant_id: string;
  quantity: number;
}

export interface CreateOrderPayload {
  email: string;
  items: OrderItem[];
  shipping: ShippingPayload;
}

export interface OrderStatus {
  id: string;
  status: 'pending' | 'paid' | 'cancelled' | 'shipped';
  payment_status: 'pending' | 'approved' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  shipping_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_tracking_code: string | null;
  total_amount: number;
  subtotal_amount: number;
  shipping_amount: number;
  currency: string;
  created_at: string;
}

export interface ShippingSelection {
  method: ShippingMethod | null;
  address: ShippingAddress | null;
}

/** Orden completa preparada para el detalle de /orden/:id. */
export interface OrderDetail {
  order: OrderStatus;
  items: Array<OrderItem & {
    id?: string;
    product_name?: string;
    sku?: string;
    unit_price?: number;
    subtotal?: number;
  }>;
  customer: {
    nombre: string;
    email: string;
    cuit: string | null;
    codigoArea: string | null;
    celular: string | null;
  } | null;
  shipping: {
    method: ShippingMethod;
    address: ShippingAddress | null;
  };
}
