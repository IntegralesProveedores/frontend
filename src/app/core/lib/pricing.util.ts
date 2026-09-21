import { PricingConfig, VolumeDiscount } from '../models/product.model';

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/** Descuento (%) de un tramo. Acepta el formato viejo `factor` por si el navegador
 *  tiene guardada una configuración anterior. */
export function discountPercentageOf(discount: VolumeDiscount): number {
  if (discount.discount_percentage !== undefined) return discount.discount_percentage;
  return discount.factor && discount.factor > 1 ? (1 - 1 / discount.factor) * 100 : 0;
}

/** Descuento (%) del tramo que corresponde a esa cantidad de packs equivalentes. */
export function volumeDiscountFor(
  equivalentPacks: number,
  config: PricingConfig | null | undefined,
): number {
  const discounts = [...(config?.volume_discounts ?? [])].sort(
    (a, b) => b.min - a.min,
  );
  const entry = discounts.find((d) => equivalentPacks >= d.min);
  return entry ? discountPercentageOf(entry) : 0;
}

/**
 * Descuento por volumen del carrito: el mayor tramo alcanzado por cualquiera de los
 * productos se aplica a TODOS (así agregar otros productos nunca lo reduce).
 */
export function cartVolumeDiscount(
  lines: Array<{ unitsPerPack: number; quantity: number; unitsPerPackMaster: number }>,
  config: PricingConfig | null | undefined,
): number {
  return lines.reduce(
    (max, line) =>
      Math.max(
        max,
        volumeDiscountFor(
          (line.unitsPerPack * line.quantity) / (line.unitsPerPackMaster || 1),
          config,
        ),
      ),
    0,
  );
}

export function calculateLocalPrice(
  costUsdMaster: number,
  unitsPerPackMaster: number,
  presentationQuantity: number,
  quantity: number,
  costCurrency: 'ARS' | 'USD' = 'USD',
  config: PricingConfig | null | undefined = undefined,
  hasPackaging = false,
  /** Si se pasa, reemplaza al descuento calculado con la cantidad de este producto (descuento del carrito). */
  discountPercentageOverride?: number,
): { price_ars: number; price_usd: number; price_sin_impuestos_ars: number } {
  const exchangeRate = config?.exchange_rate || 1;
  const packagingCost = hasPackaging ? (config?.packaging_cost ?? 0) : 0;
  const taxes = (config?.taxes ?? []).filter((t) => t.is_active);
  const discounts = [...(config?.volume_discounts ?? [])].sort(
    (a, b) => b.min - a.min,
  );
  const markup = config?.markup || 0;
  // El costo del medio de pago (Mercado Pago) va dentro del precio: todo se divide por (1 − %).
  const paymentFee = config?.payment_commission_percentage ?? 0;
  const paymentGrossUp =
    paymentFee > 0 && paymentFee < 100 ? 100 / (100 - paymentFee) : 1;

  const equivalentPacks =
    (presentationQuantity * quantity) / (unitsPerPackMaster || 1);
  const discountEntry = discounts.find((d) => equivalentPacks >= d.min);
  const discountPercentage =
    discountPercentageOverride ??
    (discountEntry ? discountPercentageOf(discountEntry) : 0);

  const costUsdMasterWithDiscount = round2(
    (costUsdMaster || 0) * (1 - discountPercentage / 100),
  );
  const effectiveRate = costCurrency === 'ARS' ? 1 : exchangeRate;
  const precioBultoArs = costUsdMasterWithDiscount * effectiveRate;
  const precioUnitarioBase = precioBultoArs / (unitsPerPackMaster || 1);
  // Precio final descontando solo los impuestos computables: incluye embalaje y packaging.
  const precioSinImpuestosArs = round2(
    (precioUnitarioBase * presentationQuantity + packagingCost) *
      (1 + markup / 100) *
      paymentGrossUp,
  );

  let costoUnitarioComputable = precioUnitarioBase;
  for (const tax of taxes) {
    const monto = precioUnitarioBase * (tax.percentage / 100);
    if (tax.is_computable) {
      costoUnitarioComputable += monto;
    }
  }

  const costoPresentacion = costoUnitarioComputable * presentationQuantity;
  // El embalaje ya no va en el precio del pack: se cobra por caja en el pedido (PackagingService).
  const costoTotalOperativo = costoPresentacion + packagingCost;
  const precioFinalArs =
    costoTotalOperativo * (1 + markup / 100) * paymentGrossUp;

  // Igual que el backend (calculatePriceV2 redondea a 2 decimales y recién ahí a pesos
  // enteros): si se redondea una sola vez, algunos precios difieren en $1 de lo que se cobra.
  const price_ars = Math.round(round2(precioFinalArs));
  const price_usd = round2(price_ars / exchangeRate);

  return {
    price_ars,
    price_usd,
    price_sin_impuestos_ars: precioSinImpuestosArs,
  };
}

export function calculateLocalPriceNoDiscount(
  costUsdMaster: number,
  unitsPerPackMaster: number,
  presentationQuantity: number,
  quantity: number,
  costCurrency: 'ARS' | 'USD' = 'USD',
  config: PricingConfig | null | undefined = undefined,
  hasPackaging = false,
) {
  return calculateLocalPrice(
    costUsdMaster,
    unitsPerPackMaster,
    presentationQuantity,
    quantity,
    costCurrency,
    config ? { ...config, volume_discounts: [] } : config,
    hasPackaging,
  );
}
