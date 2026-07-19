export interface ProductDimensions {
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  diameter_cm: number | null;
  volume_cc: number | null;
}

/** Representa una variante de presentación comercial de un producto */
export interface ProductVariant {
  id: string;
  sku: string;
  price_ars: number;
  price_usd?: number;
  cost_usd?: number;
  markup_percentage?: number;
  stock: number;
  units_per_pack: number;
  weight_grams?: number;
  dimensions: ProductDimensions;
  vat_included?: boolean;
  vat_label?: string;
}

export interface PricingTax {
  name: string;
  percentage: number;
  is_computable: boolean;
  is_active: boolean;
}

export interface VolumeDiscount {
  min: number;
  factor: number;
}

export interface PricingConfig {
  exchange_rate: number;
  embalaje_cost: number;
  taxes: PricingTax[];
  volume_discounts: VolumeDiscount[];
  markup: number;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

/** Representa la entidad de Producto comercial global */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  detail?: string | null;
  active: boolean;
  cost_usd?: number;
  units_per_pack_master?: number;
  category: ProductCategory | null;
  categories: ProductCategory[];
  variants: ProductVariant[];
  images: ProductImage[];
  created_at?: string;
  updated_at?: string;
  diameter_cm?: number | null;
  height_cm?: number | null;
  volume_cc?: number | null;
  pricing_config?: PricingConfig;
}


