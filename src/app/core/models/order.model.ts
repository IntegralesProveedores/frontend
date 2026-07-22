export interface ShippingAddress {
  recipient_name: string;
  street: string;
  street_number: string;
  floor?: string;
  apartment?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
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
  address: ShippingAddress;
  shipping_amount: number;
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


