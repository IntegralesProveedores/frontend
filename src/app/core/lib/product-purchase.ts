import { CartItem } from '../models/cart.model';
import { PricingConfig, Product, ProductVariant } from '../models/product.model';
import { calculateLocalPrice } from './pricing.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Compra de una presentación desde la ficha o el buy-box de una landing: su
//           precio (según los packs que habrá en el carrito) y la línea que se agrega.
// POR QUÉ:  La ficha y el buy-box repetían las mismas dos cuentas; si una cambiaba y la
//           otra no, el mismo producto mostraba precios distintos.
// ─────────────────────────────────────────────────────────────

/**
 * Precio por pack de una presentación. `packs` son los que habrá en el carrito (lo que se
 * agrega + lo que ya estaba), para aplicar el tramo de descuento por volumen. Sin
 * configuración cargada usa la que trae el producto.
 */
export function presentationPrice(
  product: Product,
  variant: ProductVariant,
  packs: number,
  config: PricingConfig | null | undefined,
): { price_ars: number; price_usd: number; price_sin_impuestos_ars: number } {
  return calculateLocalPrice(
    Number(product.cost_usd) || 0,
    Number(product.units_per_pack_master) || 1,
    Number(variant.units_per_pack) || 1,
    Math.max(1, packs),
    variant.cost_currency,
    config ?? product.pricing_config,
    variant.has_packaging,
  );
}

/** Línea de carrito de una presentación. Sin `imageUrl`, la primera foto del producto. */
export function toCartItem(
  product: Product,
  variant: ProductVariant,
  purchase: { quantity: number; price_ars: number; price_usd: number; imageUrl?: string },
): CartItem {
  return {
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    sku: variant.sku,
    price_ars: purchase.price_ars,
    price_usd: purchase.price_usd,
    cost_currency: variant.cost_currency,
    cost_usd: variant.cost_usd,
    cost_usd_master: product.cost_usd,
    quantity: purchase.quantity,
    imageUrl: purchase.imageUrl ?? product.images?.[0]?.url ?? '',
    stock: variant.stock,
    units_per_pack: variant.units_per_pack,
    units_per_pack_master: product.units_per_pack_master,
    has_packaging: variant.has_packaging,
    volume_cc: variant.dimensions?.volume_cc,
    product_volume_cc: product.volume_cc ?? null,
  };
}
