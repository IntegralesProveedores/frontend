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

export function calculateLocalPrice(
  costUsdMaster: number,
  unitsPerPackMaster: number,
  presentationQuantity: number,
  quantity: number,
  costCurrency: 'ARS' | 'USD' = 'USD',
  config: PricingConfig | null | undefined = undefined,
  hasPackaging = false,
): { price_ars: number; price_usd: number; price_sin_impuestos_ars: number } {
  const exchangeRate = config?.exchange_rate || 1;
  const embalageCost = config?.embalaje_cost ?? 0;
  const packagingCost = hasPackaging ? (config?.packaging_cost ?? 0) : 0;
  const taxes = (config?.taxes ?? []).filter((t) => t.is_active);
  const discounts = [...(config?.volume_discounts ?? [])].sort(
    (a, b) => b.min - a.min,
  );
  const markup = config?.markup || 0;

  const equivalentPacks =
    (presentationQuantity * quantity) / (unitsPerPackMaster || 1);
  const discountEntry = discounts.find((d) => equivalentPacks >= d.min);
  const discountPercentage = discountEntry ? discountPercentageOf(discountEntry) : 0;

  const costUsdMasterWithDiscount = round2(
    (costUsdMaster || 0) * (1 - discountPercentage / 100),
  );
  const effectiveRate = costCurrency === 'ARS' ? 1 : exchangeRate;
  const precioBultoArs = costUsdMasterWithDiscount * effectiveRate;
  const precioUnitarioBase = precioBultoArs / (unitsPerPackMaster || 1);
  const precioSinImpuestosArs = round2(
    precioUnitarioBase * presentationQuantity * (1 + markup / 100),
  );

  let costoUnitarioComputable = precioUnitarioBase;
  for (const tax of taxes) {
    const monto = precioUnitarioBase * (tax.percentage / 100);
    if (tax.is_computable) {
      costoUnitarioComputable += monto;
    }
  }

  const costoPresentacion = costoUnitarioComputable * presentationQuantity;
  const costoTotalOperativo = costoPresentacion + embalageCost + packagingCost;
  const precioFinalArs = costoTotalOperativo * (1 + markup / 100);

  const price_ars = Math.round(precioFinalArs);
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
