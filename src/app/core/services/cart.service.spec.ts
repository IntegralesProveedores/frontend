import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CartService } from './cart.service';
import { estimateStockUnits } from '../lib/cart-stock';
import { PackagingService } from './packaging.service';
import { ShippingService } from './shipping.service';
import { PaymentMethodService } from './payment-method.service';
import { PricingConfigService } from './pricing-config.service';
import { CartItem } from '../models/cart.model';
import { CONFIG } from '../../../testing/fixtures';
import { CART_EXPECTED } from './cart.service.spec.expected';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Test de caracterización del carrito: fija los precios de cada línea, el
//           agrupado, los totales, la persistencia, la sincronización con el catálogo y
//           los topes de stock tal como funcionan HOY.
// POR QUÉ:  Red de seguridad para partir CartService (estado / precios / catálogo) sin
//           cambiar nada visible. Los números esperados están en cart.service.spec.expected.ts
//           y se capturaron del código antes de refactorizar.
// ─────────────────────────────────────────────────────────────

const base = (overrides: Partial<CartItem>): CartItem => ({
  variantId: 'x', productId: 'x', productName: 'X', slug: 'x', sku: 'X', price_ars: 1,
  quantity: 1, imageUrl: '/img.webp', stock: 100, cost_currency: 'USD', ...overrides,
});

const semi48 = () => base({ variantId: 's48', productId: 'semi', productName: 'Semillera', slug: 'semillera', sku: 'SEM-048', quantity: 2, units_per_pack: 48, units_per_pack_master: 960, cost_usd_master: 19, volume_cc: 10, product_volume_cc: 10 });
const oli25 = () => base({ variantId: 'o25', productId: 'oli', productName: 'Olivo', slug: 'olivo', sku: 'OLI-025', quantity: 13, units_per_pack: 25, units_per_pack_master: 25, cost_usd_master: 7.35, volume_cc: 500, product_volume_cc: 500 });
const oli24 = () => base({ variantId: 'o24', productId: 'oli', productName: 'Olivo', slug: 'olivo', sku: 'OLI-024', quantity: 1, units_per_pack: 24, units_per_pack_master: 25, cost_usd_master: 7.35, has_packaging: true, volume_cc: 500, product_volume_cc: 500 });

let embalaje: ReturnType<typeof signal<Map<string, number>>>;
let shippingCost: ReturnType<typeof signal<number | null>>;
let http: HttpTestingController;

function setup(): CartService {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PackagingService, useValue: { embalajeByProduct: embalaje } },
      { provide: ShippingService, useValue: { shippingCost } },
    ],
  });
  http = TestBed.inject(HttpTestingController);
  return TestBed.inject(CartService);
}

/** Lo visible del carrito, en un objeto plano para comparar. */
function state(cart: CartService) {
  return {
    items: cart.cartItems().map(i => ({ v: i.variantId, q: i.quantity, ars: i.price_ars, usd: i.price_usd, noTax: i.price_sin_impuestos_ars })),
    grouped: cart.groupedCartItems().map(g => ({
      p: g.productId, units: g.totalUnits, qty: g.totalQuantity, sub: g.subtotalArs, subNoDisc: g.subtotalArsNoDiscount,
      unitNoDisc: g.unitPriceNoDiscountArs, rep: g.representativeUnitsPerPack, pres: g.presentations.map(p => `${p.variantId}x${p.quantity}`).join(','),
    })),
    itemCount: cart.itemCount(),
    subtotalArs: cart.subtotalArs(),
    subtotalSinDescuentoArs: cart.subtotalSinDescuentoArs(),
    volumeDiscountPercentage: cart.volumeDiscountPercentage(),
    shippingArs: cart.shippingArs(),
    paymentDiscountPercentage: cart.paymentDiscountPercentage(),
    paymentDiscountArs: cart.paymentDiscountArs(),
    totalAPagar: cart.totalAPagar(),
    totalUsd: Math.round(cart.totalUsd() * 100) / 100,
    totalVolumeCc: cart.totalVolumeCc(),
  };
}

/** Compara con lo capturado; si falta, lo imprime para capturarlo (y falla). */
function check(name: string, actual: unknown) {
  const expected = (CART_EXPECTED as Record<string, unknown>)[name];
  if (expected === undefined) {
    console.log(`SNAP ${name} ${JSON.stringify(actual)}`);
    fail(`falta el valor esperado de "${name}"`);
    return;
  }
  expect(actual).toEqual(expected);
}

describe('CartService (caracterización)', () => {
  beforeEach(() => {
    localStorage.removeItem('cart_items');
    localStorage.removeItem('pricing_config');
    localStorage.removeItem('checkout_payment_method_draft');
    embalaje = signal(new Map<string, number>());
    shippingCost = signal<number | null>(0);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function withConfig(): CartService {
    const cart = setup();
    TestBed.inject(PricingConfigService).setPricingConfig(CONFIG);
    http.expectOne(r => r.url.endsWith('/settings')).flush({ usd_exchange_rate: 0 });
    return cart;
  }

  it('sin configuración de precios usa el precio que trae el ítem', async () => {
    const cart = setup();
    http.expectOne(r => r.url.endsWith('/settings')).flush({ usd_exchange_rate: 0 });
    await cart.add(base({ variantId: 'a', productId: 'pa', price_ars: 5000, price_usd: 3, quantity: 2 }));
    check('sinConfig', state(cart));
  });

  it('agregar productos: descuento del carrito (el mayor tramo para todos) y embalaje repartido', async () => {
    const cart = withConfig();
    await cart.add(semi48());
    await cart.add(oli25());
    check('agregar_sinEmbalaje', state(cart));

    embalaje.set(new Map([['semi', 1351], ['oli', 2702]]));
    TestBed.flushEffects();
    check('agregar_conEmbalaje', state(cart));

    TestBed.inject(PaymentMethodService).setMethod('transferencia');
    shippingCost.set(13402);
    check('agregar_transferenciaYEnvio', state(cart));
  });

  it('agregar dos veces la misma presentación suma la cantidad', async () => {
    const cart = withConfig();
    await cart.add(semi48());
    await cart.add({ ...semi48(), quantity: 3 });
    check('agregarDosVeces', state(cart));
  });

  it('dos presentaciones del mismo producto se agrupan (y el embalaje se reparte entre ellas)', async () => {
    const cart = withConfig();
    await cart.add(oli25());
    await cart.add(oli24());
    embalaje.set(new Map([['oli', 4053]]));
    TestBed.flushEffects();
    check('agrupar', state(cart));
  });

  it('cambiar cantidad, quitar y vaciar', async () => {
    const cart = withConfig();
    await cart.add(semi48());
    await cart.add(oli25());
    await cart.updateQuantity('o25', 1);
    check('cantidad1', state(cart));
    await cart.updateQuantity('s48', 0);
    check('cantidad0', state(cart));
    cart.remove('o25');
    expect(cart.isEmpty()).toBeTrue();
    await cart.add(semi48());
    cart.clear();
    expect(cart.cartItems()).toEqual([]);
    expect(localStorage.getItem('cart_items')).toBe('[]');
  });

  it('cambiar de presentación: a una nueva y a una que ya estaba (se suman)', async () => {
    const cart = withConfig();
    await cart.add(oli25());
    await cart.changeVariant('o25', { variantId: 'o50', sku: 'OLI-050', stock: 40, units_per_pack: 50, cost_usd: 7, has_packaging: false });
    check('cambioANueva', { state: state(cart), item: cart.cartItems()[0] });

    await cart.add(oli24());
    await cart.changeVariant('o24', { variantId: 'o50', sku: 'OLI-050', stock: 40, units_per_pack: 50, has_packaging: false });
    check('cambioAExistente', state(cart));

    await cart.changeVariant('o50', { variantId: 'o50', sku: 'OLI-050', stock: 40, units_per_pack: 50 });
    await cart.changeVariant('no-existe', { variantId: 'o99', sku: 'X', stock: 1, units_per_pack: 1 });
    check('cambioAExistente', state(cart));
  });

  it('persiste en localStorage y al arrancar carga solo los ítems válidos', async () => {
    const cart = withConfig();
    await cart.add(semi48());
    const saved = JSON.parse(localStorage.getItem('cart_items')!);
    expect(saved).toEqual(cart.cartItems());
    TestBed.resetTestingModule();

    localStorage.setItem('cart_items', JSON.stringify([
      ...saved,
      { variantId: 'malo', productId: 'p', quantity: 0 },
      { productId: 'p', quantity: 1 },
      'basura',
    ]));
    const reloaded = setup();
    http.expectOne(r => r.url.endsWith('/settings')).flush({ usd_exchange_rate: 0 });
    http.expectOne(r => r.url.includes('/products')).flush({ items: [], pagination: { total_pages: 2 } });
    expect(reloaded.cartItems().map(i => i.variantId)).toEqual(['s48']);
  });

  it('localStorage corrupto: arranca vacío', () => {
    localStorage.setItem('cart_items', '{roto');
    const cart = setup();
    http.expectOne(r => r.url.endsWith('/settings')).flush({ usd_exchange_rate: 0 });
    expect(cart.cartItems()).toEqual([]);
  });

  it('cotización del dólar: actualiza la config y recalcula', async () => {
    localStorage.setItem('pricing_config', JSON.stringify(CONFIG));
    const cart = setup();
    await cart.add(semi48());
    http.expectOne(r => r.url.endsWith('/settings')).flush({ usd_exchange_rate: 1500 });
    await Promise.resolve();
    TestBed.flushEffects();
    expect(cart.dolarOficial()).toBe(1500);
    expect(TestBed.inject(PricingConfigService).pricingConfig()!.exchange_rate).toBe(1500);
    check('dolar1500', state(cart));
  });

  it('refreshPricing: pide el catálogo, saca lo borrado, toma la config nueva y el stock', async () => {
    const cart = withConfig();
    await cart.add(semi48());
    await cart.add(oli25());

    const done = cart.refreshPricing();
    const req = http.expectOne(r => r.url.endsWith('/products'));
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.has('_t')).toBeTrue();
    req.flush({
      items: [{ id: 'semi', variants: [{ id: 's48', stock: 20, units_per_pack: 48 }, { id: 's96', stock: 10, units_per_pack: 96 }] }],
      pagination: { total_pages: 1 },
      pricing_config: { ...CONFIG, markup: 70 },
    });
    await done;

    expect(cart.removedItems()).toEqual(['Olivo']);
    expect(TestBed.inject(PricingConfigService).pricingConfig()!.markup).toBe(70);
    check('refreshPricing', state(cart));

    // Stock: 20 packs x 48 = 960 unidades; ya hay 2 packs (96) en el carrito.
    expect(cart.remainingPacks('semi', 48)).toBe(18);
    expect(cart.remainingPacks('semi', 96)).toBe(9);
    expect(cart.maxQuantityFor(cart.cartItems()[0])).toBe(20);
    expect(cart.remainingPacks('otro', 10)).toBe(Infinity);
    expect(cart.remainingPacks('semi', 48, 100)).toBe(0);
  });

  it('refreshPricing con el catálogo paginado no saca nada', async () => {
    const cart = withConfig();
    await cart.add(oli25());
    const done = cart.refreshPricing();
    http.expectOne(r => r.url.endsWith('/products')).flush({ items: [], pagination: { total_pages: 3 } });
    await done;
    expect(cart.cartItems().length).toBe(1);
    expect(cart.removedItems()).toEqual([]);
  });

  it('refreshPricing con error de red no rompe', async () => {
    const cart = withConfig();
    await cart.add(oli25());
    const done = cart.refreshPricing();
    http.expectOne(r => r.url.endsWith('/products')).flush('x', { status: 500, statusText: 'err' });
    await done;
    expect(cart.cartItems().length).toBe(1);
  });

  it('estimateStockUnits toma la presentación que mejor aproxima', () => {
    expect(estimateStockUnits([{ stock: 3, units_per_pack: 600 }, { stock: 36, units_per_pack: 50 }])).toBe(1800);
    expect(estimateStockUnits([])).toBe(0);
    expect(estimateStockUnits([{ stock: undefined, units_per_pack: 10 }])).toBe(0);
  });
});
