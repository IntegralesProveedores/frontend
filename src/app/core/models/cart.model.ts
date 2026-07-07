export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  slug: string;
  sku: string;
  price_ars: number;
  price_usd?: number;
  cost_usd?: number;
  cost_usd_master?: number;
  quantity: number;
  imageUrl: string;
  stock: number;
  units_per_pack?: number;
  units_per_pack_master?: number;
  volume_cc?: number | null;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}


