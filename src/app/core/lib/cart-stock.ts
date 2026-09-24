import { CartItem } from '../models/cart.model';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Cuentas de stock del carrito (funciones puras). El stock es por unidades del
//           producto, compartido entre todas sus presentaciones.
// POR QUÉ:  Lo usan el carrito, la ficha y el buy-box; antes vivía dentro de CartService.
// ─────────────────────────────────────────────────────────────

/**
 * Unidades en stock de un producto a partir de sus presentaciones: la API da el stock de
 * cada una en packs (stock_units ÷ unidades del pack, redondeado para abajo), así que la
 * presentación más chica es la que mejor aproxima el stock en unidades.
 */
export function estimateStockUnits(
  variants: Array<{ stock?: number; units_per_pack?: number }>,
): number {
  return variants.reduce(
    (max, v) =>
      Math.max(max, (Number(v.stock) || 0) * (Number(v.units_per_pack) || 1)),
    0,
  );
}

/**
 * Packs de esa presentación que todavía entran en el stock del producto, descontando lo
 * que ya está en el carrito (todas sus presentaciones, salvo `excludeVariantId`).
 * Sin dato de stock devuelve Infinity: el backend igual valida al pagar.
 */
export function remainingPacks(
  items: readonly CartItem[],
  productId: string,
  unitsPerPack: number,
  stockUnits: number | undefined,
  excludeVariantId?: string,
): number {
  if (stockUnits === undefined) return Infinity;
  const inCart = items
    .filter((i) => i.productId === productId && i.variantId !== excludeVariantId)
    .reduce((sum, i) => sum + i.quantity * (i.units_per_pack || 1), 0);
  return Math.max(0, Math.floor((stockUnits - inCart) / (unitsPerPack || 1)));
}
