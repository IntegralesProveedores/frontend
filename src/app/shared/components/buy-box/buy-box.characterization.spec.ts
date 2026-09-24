import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { BuyBoxComponent } from './buy-box.component';
import { PackagingService } from '../../../core/services/packaging.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { CartService } from '../../../core/services/cart.service';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { CONFIG, testProduct } from '../../../../testing/fixtures';
import { matchCaptured } from '../../../../testing/captured';
import { BUY_BOX_EXPECTED } from './buy-box.characterization.spec.expected';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Test de caracterización del buy-box (landing): precio según cantidad y
//           carrito, total, tope de stock, ítem que agrega y "comprar ahora".
// POR QUÉ:  Comparte el cálculo de precio con la ficha: fija el resultado antes de unificarlo.
// ─────────────────────────────────────────────────────────────

const check = (name: string, actual: unknown) => matchCaptured(BUY_BOX_EXPECTED, `bb_${name}`, actual);

describe('BuyBoxComponent (caracterización)', () => {
  let http: HttpTestingController;
  let router: { navigate: jasmine.Spy };
  let fixture: ComponentFixture<BuyBoxComponent>;
  let comp: BuyBoxComponent;

  beforeEach(() => {
    for (const k of ['cart_items', 'pricing_config', 'checkout_payment_method_draft']) localStorage.removeItem(k);
    router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    TestBed.configureTestingModule({
      imports: [BuyBoxComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: PackagingService, useValue: { embalajeByProduct: signal(new Map()) } },
        { provide: ShippingService, useValue: { shippingCost: signal(0) } },
      ],
    }).overrideComponent(BuyBoxComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BuyBoxComponent);
    comp = fixture.componentInstance;
    http.match(r => r.url.endsWith('/settings')).forEach(r => r.flush({ usd_exchange_rate: 0 }));
    // Master de 96 u.: cada pack de 96 cuenta como 1 para los tramos de descuento.
    const p = testProduct({ units_per_pack_master: 96 });
    comp.product = p;
    comp.variant = p.variants[1];
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('precio: con la config del producto y con la del servicio', () => {
    const values: unknown[] = [comp.pricing, comp.totalArs, comp.totalUnits];
    comp.quantity.set(7);
    values.push(comp.pricing, comp.totalArs, comp.totalUnits);
    TestBed.inject(PricingConfigService).setPricingConfig({ ...CONFIG, markup: 80 });
    values.push(comp.pricing);
    check('precio', values);
  });

  it('agregar: ítem armado, precio con lo que ya está en el carrito, tope de stock', fakeAsync(() => {
    comp.imageUrl = '/olivo-pack.webp';
    expect(comp.maxQty).toBe(10);
    comp.quantity.set(12);
    let ok: boolean | undefined;
    comp.addToCart().then(r => (ok = r));
    flush();
    expect(ok).toBeTrue();
    expect(comp.added()).toBeFalse(); // ya pasaron los 2 s
    const cart = TestBed.inject(CartService);
    check('agregar_item', cart.cartItems());
    expect(comp.inCart).toBeTrue();
    expect(comp.maxQty).toBe(0);
    comp.addToCart().then(r => (ok = r));
    flush();
    expect(ok).toBeFalse();
  }));

  it('precio con unidades ya en el carrito', fakeAsync(() => {
    comp.quantity.set(2);
    comp.addToCart();
    flush();
    comp.quantity.set(1);
    check('precio_conCarrito', comp.pricing);
  }));

  it('comprar ahora: agrega y va a pagar; si ya estaba, no vuelve a sumar', fakeAsync(() => {
    comp.buyNow();
    flush();
    expect(router.navigate).toHaveBeenCalledWith(['/finalizar-compra']);
    const cart = TestBed.inject(CartService);
    expect(cart.cartItems()[0].quantity).toBe(1);
    comp.buyNow();
    flush();
    expect(cart.cartItems()[0].quantity).toBe(1);
    expect(router.navigate).toHaveBeenCalledTimes(2);
  }));

  it('increment/decrement respetan 1..maxQty', () => {
    comp.decrement();
    expect(comp.quantity()).toBe(1);
    for (let i = 0; i < 15; i++) comp.increment();
    expect(comp.quantity()).toBe(10);
  });
});
