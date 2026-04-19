export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  slug: string;
  sku: string;
  price_ars: number;
  price_usd?: number;
  cost_usd?: number;
  quantity: number;
  imageUrl: string;
  stock: number;
  units_per_pack?: number;
  volume_cc?: number | null;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}


