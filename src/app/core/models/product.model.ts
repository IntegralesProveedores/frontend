export interface ProductDimensions {
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  diameter_cm: number | null;
  volume_cc: number | null;
}

export interface ProductVariant {
  id: string;
  sku: string;
  price_ars: number;
  price_usd?: number;
  cost_usd?: number;
  markup_percentage?: number;
  stock: number;
  units_per_pack: number;
  weight_grams: number;
  dimensions: ProductDimensions;
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

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  category: ProductCategory | null;
  categories: ProductCategory[];
  variants: ProductVariant[];
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}


