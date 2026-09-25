import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { CheckoutComponent } from './checkout.component';
import { ShippingService } from '../../core/services/shipping.service';
import { PackagingService } from '../../core/services/packaging.service';
import { MercadoPagoService } from '../../core/services/mercadopago.service';
import { CartService } from '../../core/services/cart.service';
import { PaymentMethodService } from '../../core/services/payment-method.service';
import { CustomerDraftService } from '../../core/services/customer-draft.service';
import { CONFIG } from '../../../testing/fixtures';
import { matchCaptured } from '../../../testing/captured';
import { CHECKOUT_EXPECTED } from './checkout.characterization.spec.expected';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Test de caracterización del checkout: qué se le manda al backend (transferencia
//           y Mercado Pago), qué se limpia al confirmar, adónde navega y cómo reacciona a
//           cada error (precio cambiado, pedido duplicado, sin stock, error genérico).
// POR QUÉ:  Red de seguridad para sacar el envío del pedido a un servicio sin cambiar nada.
// ─────────────────────────────────────────────────────────────

const check = (name: string, actual: unknown) => matchCaptured(CHECKOUT_EXPECTED, name, actual);

const ADDRESS = {
  recipient_name: '', postal_code: '1414', province: 'CABA', locality: 'Palermo', county: 'CABA',
  street: 'Gurruchaga', street_number: '1234', floor: '2', apartment: 'B', country: 'AR',
};
const CUSTOMER = { nombre: 'Ana Pérez', email: 'ana@example.com', cuit: '20-12345678-9', codigoArea: '11', celular: '12345678' };
const CART = [
  { variantId: 'v48', productId: 'p1', productName: 'Cono 10', slug: 'cono-10', sku: 'C-48', price_ars: 2500, price_usd: 1.72, quantity: 3, imageUrl: '', stock: 20, units_per_pack: 48 },
  { variantId: 'v96', productId: 'p1', productName: 'Cono 10', slug: 'cono-10', sku: 'C-96', price_ars: 4800, price_usd: 3.31, quantity: 1, imageUrl: '', stock: 10, units_per_pack: 96 },
];
const MP_ACCOUNT = { bank_name: 'Mercado Pago', alias: 'brotalia.mp', cvu: '000123', cbu: null, account_number: null, account_holder_name: 'Brotalia', account_holder_tax_id: '30-1', position: 1 };

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('CheckoutComponent (caracterización)', () => {
  let http: HttpTestingController;
  let router: { navigate: jasmine.Spy };
  let mercadoPago: { startCheckout: jasmine.Spy };
  let shipping: {
    current: ReturnType<typeof signal<any>>; quote: ReturnType<typeof signal<any>>; shippingCost: ReturnType<typeof signal<number | null>>;
    isValid: ReturnType<typeof signal<boolean>>; setAddress: jasmine.Spy; clear: jasmine.Spy; refreshQuote: jasmine.Spy;
  };
  let packagingReady: ReturnType<typeof signal<boolean>>;
  let turnstile: { reset: jasmine.Spy };
  let fixture: ComponentFixture<CheckoutComponent>;
  let comp: CheckoutComponent;
  let uuid = 0;

  function create(cart: unknown[] = CART) {
    localStorage.setItem('cart_items', JSON.stringify(cart));
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: MercadoPagoService, useValue: mercadoPago },
        { provide: ShippingService, useValue: shipping },
        { provide: PackagingService, useValue: { embalajeByProduct: signal(new Map()), ready: packagingReady } },
      ],
    }).overrideComponent(CheckoutComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CheckoutComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit
    // Después del primer render: la plantilla vacía deja el @ViewChild en undefined.
    (comp as unknown as { turnstile: unknown }).turnstile = turnstile;
    flushStartup();
  }

  function flushStartup() {
    http.match(r => r.url.endsWith('/settings')).forEach(r => r.flush({ usd_exchange_rate: 0 }));
    http.match(r => r.url.endsWith('/products')).forEach(r => r.flush({ items: [], pagination: { total_pages: 2 } }));
    http.match(r => r.url.endsWith('/payment-transfer-info')).forEach(r => r.flush([{ ...MP_ACCOUNT, bank_name: 'Otro' }, MP_ACCOUNT]));
  }

  function fill() {
    Object.assign(comp.customer, CUSTOMER);
    comp.onCaptchaToken('tok-1');
  }

  /** Estado visible después de un intento. */
  function outcome() {
    return {
      loading: comp.loading, paymentLoading: comp.paymentLoading,
      priceChanged: comp.priceChanged(), insufficientStock: comp.insufficientStock(), retryNeeded: comp.retryNeeded(),
      captchaMissing: comp.captchaMissing(), turnstileResets: turnstile.reset.calls.count(),
      navigate: router.navigate.calls.allArgs(),
      refreshQuote: shipping.refreshQuote.calls.count(),
      cartLength: TestBed.inject(CartService).cartItems().length,
      attemptKey: sessionStorage.getItem('checkout_idempotency_key'),
      draft: localStorage.getItem('checkout_customer_draft'),
      paymentMethod: localStorage.getItem('checkout_payment_method_draft'),
      shippingCleared: shipping.clear.calls.count(),
    };
  }

  async function submitTransferAndFail(error: HttpErrorResponse | null) {
    TestBed.inject(PaymentMethodService).setMethod('transferencia');
    fill();
    const done = comp.pagarAhora(true);
    const req = http.expectOne(r => r.url.endsWith('/orders'));
    if (error) req.flush(error.error, { status: error.status, statusText: 'err' });
    else req.flush({ order_ref: 'REF-1' });
    // price_changed pide el catálogo de nuevo antes de terminar.
    await Promise.resolve();
    await new Promise(r => setTimeout(r));
    http.match(r => r.url.endsWith('/products')).forEach(r => r.flush({ items: [], pagination: { total_pages: 2 } }));
    await done;
    return req.request.body;
  }

  beforeEach(() => {
    for (const k of ['cart_items', 'pricing_config', 'checkout_payment_method_draft', 'checkout_customer_draft']) localStorage.removeItem(k);
    sessionStorage.removeItem('checkout_idempotency_key');
    localStorage.setItem('pricing_config', JSON.stringify(CONFIG));
    uuid = 0;
    spyOn(crypto, 'randomUUID').and.callFake(() => `00000000-0000-4000-8000-00000000000${++uuid}` as `${string}-${string}-${string}-${string}-${string}`);
    router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    mercadoPago = { startCheckout: jasmine.createSpy('startCheckout').and.resolveTo(undefined) };
    const current = signal<any>({ method: 'delivery', address: { ...ADDRESS } });
    shipping = {
      current,
      quote: signal<any>({ price_ars: 13402 }),
      shippingCost: signal<number | null>(13402),
      isValid: signal(true),
      setAddress: jasmine.createSpy('setAddress').and.callFake((a: unknown) => current.set({ ...current(), address: a })),
      clear: jasmine.createSpy('clear'),
      refreshQuote: jasmine.createSpy('refreshQuote'),
    };
    packagingReady = signal(true);
    turnstile = { reset: jasmine.createSpy('reset') };
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    for (const k of ['cart_items', 'pricing_config', 'checkout_payment_method_draft', 'checkout_customer_draft']) localStorage.removeItem(k);
    sessionStorage.removeItem('checkout_idempotency_key');
  });

  it('al entrar: borrador del cliente, datos de transferencia de Mercado Pago y costo de envío', () => {
    localStorage.setItem('checkout_customer_draft', JSON.stringify(CUSTOMER));
    create();
    expect(comp.customer).toEqual(CUSTOMER);
    expect(comp.mercadoPagoTransferInfo()?.alias).toBe('brotalia.mp');
    expect(comp.shippingCost()).toBe(13402);
    expect(comp.shippingMethod()).toBe('delivery');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('carrito vacío: vuelve al carrito', () => {
    create([]);
    expect(router.navigate).toHaveBeenCalledWith(['/carrito']);
  });

  it('pagarAhora no envía nada si falta algo (y pide el captcha)', async () => {
    create();
    Object.assign(comp.customer, CUSTOMER);
    await comp.pagarAhora(false);
    await comp.pagarAhora(true); // sin captcha
    expect(comp.captchaMissing()).toBeTrue();
    comp.onCaptchaToken('tok');
    expect(comp.captchaMissing()).toBeFalse();
    shipping.isValid.set(false);
    await comp.pagarAhora(true);
    shipping.isValid.set(true);
    packagingReady.set(false);
    await comp.pagarAhora(true);
    expect(comp.formSubmitted).toBeTrue();
    expect(comp.shippingFormSubmitted).toBeTrue();
    expect(mercadoPago.startCheckout).not.toHaveBeenCalled();
    http.expectNone(r => r.url.endsWith('/orders'));
  });

  it('transferencia OK: envía el pedido, limpia todo y va a /orden/exito', async () => {
    create();
    const body = await submitTransferAndFail(null);
    check('transferencia_payload', body);
    check('transferencia_ok', outcome());
    expect(shipping.setAddress).toHaveBeenCalledWith({ ...ADDRESS, recipient_name: 'Ana Pérez' });
    fixture.destroy(); // no vuelve a guardar el borrador
    expect(localStorage.getItem('checkout_customer_draft')).toBeNull();
  });

  it('transferencia: 409 price_changed → actualiza precios y envío, avisa, no navega', async () => {
    create();
    await submitTransferAndFail(httpError(409, { error: 'price_changed' }));
    check('transferencia_priceChanged', outcome());
  });

  it('transferencia: 409 idempotency_conflict → descarta la key y pide confirmar de nuevo', async () => {
    create();
    await submitTransferAndFail(httpError(409, { error: 'idempotency_conflict' }));
    check('transferencia_idempotency', outcome());
  });

  it('transferencia: sin stock → avisa en la página', async () => {
    create();
    await submitTransferAndFail(httpError(400, { error: 'Insufficient stock for C-48' }));
    check('transferencia_sinStock', outcome());
  });

  it('transferencia: error genérico → /orden/error', async () => {
    create();
    await submitTransferAndFail(httpError(500, { error: 'boom' }));
    check('transferencia_error', outcome());
  });

  it('Mercado Pago OK: guarda el borrador y arranca el checkout con el pedido', async () => {
    create();
    fill();
    await comp.pagarAhora(true);
    check('mp_payload', mercadoPago.startCheckout.calls.mostRecent().args[0]);
    check('mp_ok', outcome());
  });

  it('Mercado Pago: errores', async () => {
    const results: Record<string, unknown> = {};
    for (const [name, err] of [
      ['priceChanged', httpError(409, { error: 'price_changed' })],
      ['idempotency', httpError(409, { error: 'idempotency_conflict' })],
      ['sinStock', httpError(409, { error: 'Insufficient stock' })],
      ['generico', new Error('Mercado Pago checkout URL is unavailable')],
    ] as const) {
      create();
      fill();
      mercadoPago.startCheckout.and.rejectWith(err);
      const done = comp.pagarAhora(true);
      await new Promise(r => setTimeout(r));
      http.match(r => r.url.endsWith('/products')).forEach(r => r.flush({ items: [], pagination: { total_pages: 2 } }));
      await done;
      results[name] = outcome();
      http.verify();
      TestBed.resetTestingModule();
      router.navigate.calls.reset();
      turnstile.reset.calls.reset();
      shipping.refreshQuote.calls.reset();
    }
    check('mp_errores', results);
  });

  it('misma compra → misma idempotency key; si cambia algo → key nueva', async () => {
    create();
    fill();
    await comp.pagarAhora(true);
    await comp.pagarAhora(true);
    comp.customer.celular = '87654321';
    await comp.pagarAhora(true);
    const keys = mercadoPago.startCheckout.calls.allArgs().map(a => a[0].idempotency_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('retiro en el local: sin dirección en el pedido', async () => {
    create();
    shipping.current.set({ method: 'pickup' });
    fill();
    await comp.pagarAhora(true);
    check('mp_retiro_shipping', mercadoPago.startCheckout.calls.mostRecent().args[0].shipping);
    expect(comp.shippingCost()).toBe(0);
    expect(shipping.setAddress).not.toHaveBeenCalled();
  });

  it('al salir sin comprar guarda el borrador y el destinatario', () => {
    create();
    Object.assign(comp.customer, CUSTOMER);
    fixture.destroy();
    expect(TestBed.inject(CustomerDraftService).current()).toEqual(CUSTOMER);
    expect(shipping.setAddress).toHaveBeenCalledWith({ ...ADDRESS, recipient_name: 'Ana Pérez' });
  });

  it('formato de CUIT, teléfono, medio de pago y copiar', async () => {
    create();
    const cuits = ['2', '201', '20123456789', '20-12.345.678-9-99'].map(v => {
      comp.onCuitInput({ target: { value: v } });
      return comp.customer.cuit;
    });
    check('cuit', cuits);
    const input = document.createElement('input');
    input.value = '11a2345678901';
    comp.filterNumericInput({ target: input } as unknown as Event, 'codigoArea');
    expect([input.value, comp.customer.codigoArea]).toEqual(['1123', '1123']);
    input.value = '1-2345678901';
    comp.filterNumericInput({ target: input } as unknown as Event, 'celular');
    expect(comp.customer.celular).toBe('12345678');
    comp.selectPaymentMethod('transferencia');
    expect(TestBed.inject(PaymentMethodService).current()).toBe('transferencia');
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await comp.copyToClipboard('brotalia.mp', 'alias');
    expect(write).toHaveBeenCalledWith('brotalia.mp');
    expect(comp.copiedField()).toBe('alias');
  });
});
