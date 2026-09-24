import { PricingConfig, Product } from '../app/core/models/product.model';

// Datos de prueba compartidos por los tests de caracterización del carrito, la ficha y el buy-box.

export const CONFIG: PricingConfig = {
  exchange_rate: 1450,
  packaging_cost: 2000,
  taxes: [{ name: 'IVA', percentage: 21, is_computable: false, is_active: true }],
  volume_discounts: [
    { min: 3, discount_percentage: 5 },
    { min: 6, discount_percentage: 10 },
    { min: 11, discount_percentage: 15 },
  ],
  markup: 60,
  payment_commission_percentage: 10,
};

export function testProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1', name: 'Cono 10', slug: 'cono-10', description: '', active: true,
    cost_usd: 19, units_per_pack_master: 960, volume_cc: 10,
    category: { name: 'Conos', slug: 'conos', parent: { name: 'Macetas', slug: 'macetas' } },
    categories: [],
    images: [{ url: '/img/cono.webp' }],
    variants: [
      { id: 'v48', sku: 'C-48', price_ars: 2449, price_usd: 1.69, stock: 20, units_per_pack: 48, cost_currency: 'USD', cost_usd: 0.95, dimensions: { volume_cc: 10 } },
      { id: 'v96', sku: 'C-96', price_ars: 4800, price_usd: 3.31, stock: 10, units_per_pack: 96, cost_currency: 'USD', cost_usd: 1.9, dimensions: { volume_cc: 10 }, has_packaging: true },
    ],
    pricing_config: CONFIG,
    ...overrides,
  } as unknown as Product;
}
