import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ProductDetailComponent } from './product-detail.component';
import { PackagingService } from '../../core/services/packaging.service';
import { ShippingService } from '../../core/services/shipping.service';
import { CartService } from '../../core/services/cart.service';
import { Product } from '../../core/models/product.model';
import { testProduct } from '../../../testing/fixtures';
import { matchCaptured } from '../../../testing/captured';
import { PRODUCT_DETAIL_EXPECTED } from './product-detail.characterization.spec.expected';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Test de caracterización de la ficha de producto: precio (con lo que ya hay en
//           el carrito), tope de stock, título/meta/canonical, JSON-LD, agregar al carrito,
//           cambio de presentación desde el carrito, errores y redirección a la landing.
// POR QUÉ:  Red de seguridad para sacar el SEO a un servicio y compartir el cálculo de
//           precio con el buy-box sin cambiar nada visible.
// ─────────────────────────────────────────────────────────────

const check = (name: string, actual: unknown) => matchCaptured(PRODUCT_DETAIL_EXPECTED, name, actual);

describe('ProductDetailComponent (caracterización)', () => {
  let http: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };
  let fixture: ComponentFixture<ProductDetailComponent>;
  let comp: ProductDetailComponent;

  function create(slug: string, variant: string | null = null) {
    const params: Record<string, string> = { slug };
    if (variant !== null) params['variant'] = variant;
    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(params)) } },
        { provide: Router, useValue: router },
        { provide: PackagingService, useValue: { embalajeByProduct: signal(new Map()) } },
        { provide: ShippingService, useValue: { shippingCost: signal(0) } },
      ],
    }).overrideComponent(ProductDetailComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductDetailComponent);
    comp = fixture.componentInstance;
    http.match(r => r.url.endsWith('/settings')).forEach(r => r.flush({ usd_exchange_rate: 0 }));
  }

  function init(product: Product | null, status = 200) {
    fixture.detectChanges();
    const req = http.expectOne(r => /\/products\/[^/]+$/.test(r.url));
    if (product) req.flush(product);
    else req.flush('x', { status, statusText: 'err' });
    http.expectOne(r => r.url.endsWith('/products')).flush({ items: [testProduct()], pagination: { total_pages: 1 } });
    TestBed.flushEffects();
  }

  function seo() {
    const meta = (sel: string) => document.head.querySelector(`meta[${sel}]`)?.getAttribute('content') ?? null;
    const json = (id: string) => JSON.parse(document.getElementById(id)?.textContent ?? 'null');
    return {
      title: document.title,
      description: meta('name="description"'),
      ogTitle: meta('property="og:title"'),
      ogDescription: meta('property="og:description"'),
      ogUrl: meta('property="og:url"'),
      ogImage: meta('property="og:image"'),
      twitterTitle: meta('name="twitter:title"'),
      twitterDescription: meta('name="twitter:description"'),
      twitterImage: meta('name="twitter:image"'),
      canonicals: Array.from(document.head.querySelectorAll('link[rel="canonical"]')).map(l => l.getAttribute('href')),
      product: json('product-jsonld'),
      breadcrumb: json('breadcrumb-jsonld'),
    };
  }

  beforeEach(() => {
    for (const k of ['cart_items', 'pricing_config', 'checkout_payment_method_draft']) localStorage.removeItem(k);
    for (const sel of ['#product-jsonld', '#breadcrumb-jsonld', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'meta[name="description"]'])
      document.head.querySelectorAll(sel).forEach(e => e.remove());
    router = { navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) };
    spyOn(window, 'scrollTo');
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('carga: SEO, JSON-LD, breadcrumb y presentación elegida', () => {
    create('cono-10');
    init(testProduct());
    check('seo_sinPresentacion', seo());
    check('carga_sinPresentacion', {
      selected: comp.selectedVariant()?.id,
      price: comp.currentPricing(),
      breadcrumb: comp.breadcrumbItems(),
      maxQty: comp.maxQty,
      inStock: comp.inStock,
      loading: comp.loading(),
      error: comp.error(),
    });
  });

  it('con presentación en la URL, descripción propia e imagen absoluta', () => {
    create('cono-10', '96');
    init(testProduct({ description: '  Cono de turba.  ', images: [{ url: 'https://cdn.x/cono.webp' }] } as Partial<Product>));
    check('seo_conPresentacion', seo());
    expect(comp.selectedVariant()?.id).toBe('v96');
    expect(comp.editSourceVariantId()).toBeNull();
  });

  it('una sola presentación: Offer en vez de AggregateOffer, sin stock y sin imagen', () => {
    create('cono-10');
    const p = testProduct({ images: [] } as Partial<Product>);
    p.variants = [{ ...p.variants[0], stock: 0 }];
    init(p);
    check('seo_unaPresentacion', seo());
  });

  it('precio dinámico (debounce 350 ms) según cantidad y lo que ya hay en el carrito', fakeAsync(() => {
    create('cono-10');
    // Master de 48 u.: cada pack de 48 cuenta como 1 para los tramos de descuento (3→5 %, 6→10 %).
    init(testProduct({ units_per_pack_master: 48 }));
    tick(350);
    const prices: unknown[] = [comp.currentPricing()];
    comp.quantity.set(3);
    TestBed.flushEffects();
    tick(349);
    prices.push(comp.currentPricing()); // todavía no cambió
    tick(1);
    prices.push(comp.currentPricing());
    comp.quantity.set(5);
    TestBed.flushEffects();
    tick(350);
    comp.addToCart();
    flush();
    TestBed.flushEffects();
    tick(350);
    prices.push(comp.currentPricing()); // 1 + 5 del carrito
    comp.quantity.set(2);
    TestBed.flushEffects();
    tick(350);
    prices.push(comp.currentPricing()); // 2 + 5 del carrito
    check('precioDinamico', prices);
    flush();
  }));

  it('agregar al carrito: ítem armado, tope de stock y aviso "agregado"', fakeAsync(() => {
    create('cono-10');
    init(testProduct());
    // Sin catálogo pedido por el carrito, el stock sale de las presentaciones del producto.
    expect(comp.maxQty).toBe(20);
    comp.quantity.set(25);
    comp.addToCart(); // se recorta al máximo
    flush();
    const cart = TestBed.inject(CartService);
    check('agregar_item', cart.cartItems());
    expect(comp.maxQty).toBe(0);
    expect(comp.inStock).toBeFalse();
    comp.increment();
    expect(comp.quantity()).toBe(20);
    expect(comp.hasCurrentProductInCart()).toBeTrue();
    flush();
  }));

  it('increment/decrement respetan 1..maxQty', () => {
    create('cono-10', '96');
    init(testProduct());
    expect(comp.maxQty).toBe(10);
    comp.decrement();
    expect(comp.quantity()).toBe(1);
    for (let i = 0; i < 15; i++) comp.increment();
    expect(comp.quantity()).toBe(10);
  });

  it('entrar desde el carrito y cambiar de presentación mueve la línea', fakeAsync(() => {
    localStorage.setItem('cart_items', JSON.stringify([
      { variantId: 'v48', productId: 'p1', productName: 'Cono 10', slug: 'cono-10', sku: 'C-48', price_ars: 2449, quantity: 4, imageUrl: '', stock: 20, units_per_pack: 48, units_per_pack_master: 960, cost_usd_master: 19, cost_currency: 'USD' },
    ]));
    create('cono-10', '48');
    http.expectOne(r => r.url.endsWith('/products') && r.params.has('_t')).flush({ items: [testProduct()], pagination: { total_pages: 1 } });
    init(testProduct());
    expect(comp.editSourceVariantId()).toBe('v48');
    comp.selectVariant(comp.product()!.variants[1]);
    flush();
    const cart = TestBed.inject(CartService);
    check('cambioPresentacion', { edit: comp.editSourceVariantId(), selected: comp.selectedVariant()?.id, items: cart.cartItems() });
    flush();
  }));

  it('un solo ítem del producto en el carrito: lo preselecciona sin modo edición', () => {
    localStorage.setItem('cart_items', JSON.stringify([
      { variantId: 'v96', productId: 'p1', productName: 'Cono 10', slug: 'cono-10', sku: 'C-96', price_ars: 1, quantity: 1, imageUrl: '', stock: 10, units_per_pack: 96 },
    ]));
    create('cono-10');
    http.expectOne(r => r.url.endsWith('/products') && r.params.has('_t')).flush({ items: [testProduct()], pagination: { total_pages: 1 } });
    init(testProduct());
    expect(comp.selectedVariant()?.id).toBe('v96');
    expect(comp.editSourceVariantId()).toBeNull();
    comp.quantity.set(3);
    comp.selectVariant(comp.product()!.variants[0]);
    expect(comp.quantity()).toBe(1);
    expect(comp.selectedVariant()?.id).toBe('v48');
  });

  it('404 → no encontrado; error de red → reintentable', () => {
    create('no-existe');
    init(null, 404);
    expect(comp.error()).toBe('not-found');
    expect(document.title).toBe('Producto no encontrado | Brotalia');
    expect(comp.loading()).toBeFalse();
    TestBed.resetTestingModule();

    create('cono-10');
    init(null, 500);
    expect(comp.error()).toBe('network');
    expect(document.title).toBe('Brotalia | Macetas Biodegradables');
    comp.retryLoad();
    http.expectOne(r => r.url.endsWith('/products/cono-10')).flush(testProduct());
    expect(comp.error()).toBeNull();
    expect(comp.product()?.id).toBe('p1');
  });

  it('presentación de landing: redirige y la ficha no la muestra', () => {
    create('olivo', '24');
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/olivo/pack', { replaceUrl: true });
    http.expectOne(r => r.url.endsWith('/products')).flush({ items: [], pagination: { total_pages: 1 } });
    TestBed.resetTestingModule();

    create('olivo');
    const p = testProduct({ slug: 'olivo', name: 'Olivo' });
    p.variants = [{ ...p.variants[0], id: 'o24', units_per_pack: 24 }, { ...p.variants[1], id: 'o25', units_per_pack: 25 }];
    init(p);
    expect(comp.product()!.variants.map(v => v.id)).toEqual(['o25']);
  });

  it('al salir borra los JSON-LD', () => {
    create('cono-10');
    init(testProduct());
    expect(document.getElementById('product-jsonld')).not.toBeNull();
    fixture.destroy();
    expect(document.getElementById('product-jsonld')).toBeNull();
    expect(document.getElementById('breadcrumb-jsonld')).toBeNull();
  });
});
