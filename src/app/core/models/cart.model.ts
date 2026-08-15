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
  /** Volumen del PRODUCTO (Product.volume_cc), no de la caja/presentación. Se usa para ordenar la lista del carrito. */
  product_volume_cc?: number | null;
}

export interface GroupedCartItemPresentation {
  variantId: string;
  units_per_pack: number;
  quantity: number;
}

export interface GroupedCartItem {
  productId: string;
  productName: string;
  slug: string;
  imageUrl: string;
  representativeUnitsPerPack: number;
  totalQuantity: number;
  totalUnits: number;
  subtotalArs: number;
  presentations: GroupedCartItemPresentation[];
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}


