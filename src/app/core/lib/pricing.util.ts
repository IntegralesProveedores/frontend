import { PricingConfig } from '../models/product.model';

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function calculateLocalPrice(
  costUsdMaster: number,
  unitsPerPackMaster: number,
  presentationQuantity: number,
  quantity: number,
  costCurrency: 'ARS' | 'USD' = 'USD',
  config: PricingConfig | null | undefined = undefined
): { price_ars: number; price_usd: number; price_sin_impuestos_ars: number } {
  const exchangeRate = config?.exchange_rate || 1;
  const embalageCost = config?.embalaje_cost ?? 0;
  const taxes = (config?.taxes ?? []).filter(t => t.is_active);
  const discounts = [...(config?.volume_discounts ?? [])].sort((a, b) => b.min - a.min);
  const markup = config?.markup || 0;

  const equivalentPacks = (presentationQuantity * quantity) / (unitsPerPackMaster || 1);
  const discountEntry = discounts.find(d => equivalentPacks >= d.min);
  const discountFactor = discountEntry ? discountEntry.factor : 1;

  const costUsdMasterWithDiscount = round2((costUsdMaster || 0) / discountFactor);
  const effectiveRate = costCurrency === 'ARS' ? 1 : exchangeRate;
  const precioBultoArs = costUsdMasterWithDiscount * effectiveRate;
  const precioUnitarioBase = precioBultoArs / (unitsPerPackMaster || 1);
  const precioSinImpuestosArs = round2(precioUnitarioBase * presentationQuantity * (1 + markup / 100));

  let costoUnitarioComputable = precioUnitarioBase;
  for (const tax of taxes) {
    const monto = precioUnitarioBase * (tax.percentage / 100);
    if (tax.is_computable) {
      costoUnitarioComputable += monto;
    }
  }

  const costoPresentacion = costoUnitarioComputable * presentationQuantity;
  const costoTotalOperativo = costoPresentacion + embalageCost;
  const precioFinalArs = costoTotalOperativo * (1 + markup / 100);

  const price_ars = Math.round(precioFinalArs);
  const price_usd = round2(price_ars / effectiveRate);

  return { price_ars, price_usd, price_sin_impuestos_ars: precioSinImpuestosArs };
}

export function calculateLocalPriceNoDiscount(
  costUsdMaster: number,
  unitsPerPackMaster: number,
  presentationQuantity: number,
  quantity: number,
  costCurrency: 'ARS' | 'USD' = 'USD',
  config: PricingConfig | null | undefined = undefined
) {
  return calculateLocalPrice(costUsdMaster, unitsPerPackMaster, presentationQuantity, quantity, costCurrency, config ? { ...config, volume_discounts: [] } : config);
}
