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

export interface OrderItem {
  variant_id: string;
  quantity: number;
}

export interface ShippingSelection {
  method: ShippingMethod | null;
  address: ShippingAddress | null;
}
