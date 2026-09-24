import { CartItem, GroupedCartItem } from '../models/cart.model';
import { PricingConfig } from '../models/product.model';
import {
  calculateLocalPrice,
  calculateLocalPriceNoDiscount,
  cartVolumeDiscount,
  embalajePerPackArs,
} from './pricing.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Precios del carrito como funciones puras: precio de una línea al agregarla o
//           cambiarla, recálculo de todo el carrito (descuento del carrito + embalaje
//           repartido) y agrupado por producto para mostrarlo.
// POR QUÉ:  Antes vivía dentro de CartService junto con el guardado y la sincronización
//           con el backend. Separado se puede probar sin Angular ni red.
// ─────────────────────────────────────────────────────────────

type LinePricing = Pick<CartItem, 'price_ars' | 'price_usd' | 'price_sin_impuestos_ars'>;
type EmbalajeByProduct = ReadonlyMap<string, number>;

/**
 * Precio de una línea con su cantidad (sin descuento del carrito ni embalaje: eso lo
 * aplica repriceCart después). Sin configuración o sin costos del producto, conserva el
 * precio que ya traía `base`.
 */
export function priceLine(
  base: CartItem,
  presentation: { unitsPerPack?: number; hasPackaging?: boolean },
  quantity: number,
  config: PricingConfig | null | undefined,
): LinePricing {
  if (!config || !base.cost_usd_master || !base.units_per_pack_master || !presentation.unitsPerPack) {
    return {
      price_ars: base.price_ars,
      price_usd: base.price_usd,
      price_sin_impuestos_ars: base.price_sin_impuestos_ars,
    };
  }
  return calculateLocalPrice(
    Number(base.cost_usd_master) || 0,
    Number(base.units_per_pack_master) || 1,
    Number(presentation.unitsPerPack) || 1,
    quantity,
    base.cost_currency,
    config,
    presentation.hasPackaging,
  );
}

/** Unidades totales de cada producto en el carrito (todas sus presentaciones). */
function unitsByProduct(items: readonly CartItem[]): Map<string, number> {
  const productUnits = new Map<string, number>();
  for (const item of items) {
    const units = (Number(item.units_per_pack) || 1) * item.quantity;
    productUnits.set(item.productId, (productUnits.get(item.productId) ?? 0) + units);
  }
  return productUnits;
}

/**
 * Recalcula el precio de todas las líneas: el mayor tramo de descuento alcanzado por algún
 * producto se aplica a todos, y el embalaje de cada producto se reparte entre sus líneas
 * (ver embalajePerPackArs). Las líneas sin costos del producto quedan como están.
 */
export function repriceCart(
  items: readonly CartItem[],
  config: PricingConfig | null | undefined,
  embalajeByProduct: EmbalajeByProduct,
): CartItem[] {
  const exchangeRate = config?.exchange_rate || 1;
  const cartDiscount = cartVolumeDiscount(
    items.map((item) => ({
      unitsPerPack: Number(item.units_per_pack) || 1,
      quantity: item.quantity,
      unitsPerPackMaster: Number(item.units_per_pack_master) || 1,
    })),
    config,
  );
  const productUnits = unitsByProduct(items);

  return items.map((item) => {
    if (!config || !item.cost_usd_master || !item.units_per_pack_master || !item.units_per_pack) {
      return item;
    }

    const pricing = calculateLocalPrice(
      Number(item.cost_usd_master) || 0,
      Number(item.units_per_pack_master) || 1,
      Number(item.units_per_pack) || 1,
      item.quantity,
      item.cost_currency,
      config,
      item.has_packaging,
      cartDiscount,
    );
    const embalajeAdd = embalajePerPackArs(
      embalajeByProduct.get(item.productId) ?? 0,
      productUnits.get(item.productId) ?? 0,
      Number(item.units_per_pack) || 1,
    );
    const price_ars = pricing.price_ars + embalajeAdd;
    return {
      ...item,
      price_ars,
      price_usd: Math.round((price_ars / exchangeRate) * 100) / 100,
      price_sin_impuestos_ars: pricing.price_sin_impuestos_ars + embalajeAdd,
    };
  });
}

/**
 * Carrito agrupado por producto, ordenado por volumen de la maceta. Incluye el subtotal de
 * lista (sin descuento por volumen) con el mismo reparto de embalaje que repriceCart: si no,
 * el % de descuento mostrado queda mal (el embalaje no se descuenta, pero tiene que estar
 * en los dos lados).
 */
export function groupCartItems(
  items: readonly CartItem[],
  config: PricingConfig | null | undefined,
  embalajeByProduct: EmbalajeByProduct,
): GroupedCartItem[] {
  const map = new Map<string, GroupedCartItem>();
  const productUnits = unitsByProduct(items);

  for (const item of items) {
    const unitsPerPack = item.units_per_pack || 1;
    const totalUnits = unitsPerPack * item.quantity;
    const subtotal = (item.price_ars || 0) * item.quantity;
    const embalajeAdd = embalajePerPackArs(
      embalajeByProduct.get(item.productId) ?? 0,
      productUnits.get(item.productId) ?? 0,
      unitsPerPack,
    );
    const noDiscount =
      config && item.cost_usd_master && item.units_per_pack_master && unitsPerPack
        ? calculateLocalPriceNoDiscount(
            Number(item.cost_usd_master),
            Number(item.units_per_pack_master),
            unitsPerPack,
            item.quantity,
            item.cost_currency,
            config,
            item.has_packaging,
          )
        : { price_ars: item.price_ars || 0 };
    const subtotalNoDiscount = (noDiscount.price_ars + embalajeAdd) * item.quantity;
    const presentation = {
      variantId: item.variantId,
      units_per_pack: unitsPerPack,
      quantity: item.quantity,
    };
    const existing = map.get(item.productId);
    if (existing) {
      existing.totalUnits += totalUnits;
      existing.totalQuantity += item.quantity;
      existing.subtotalArs += subtotal;
      existing.subtotalArsNoDiscount += subtotalNoDiscount;
      existing.presentations.push(presentation);
    } else {
      map.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        slug: item.slug,
        imageUrl: item.imageUrl,
        representativeUnitsPerPack: unitsPerPack,
        totalQuantity: item.quantity,
        totalUnits,
        subtotalArs: subtotal,
        unitPriceNoDiscountArs: noDiscount.price_ars + embalajeAdd,
        subtotalArsNoDiscount: subtotalNoDiscount,
        presentations: [presentation],
      });
    }
  }

  const volumeOf = (productId: string) =>
    items.find((item) => item.productId === productId)?.product_volume_cc ?? 0;
  return Array.from(map.values()).sort((a, b) => volumeOf(a.productId) - volumeOf(b.productId));
}
