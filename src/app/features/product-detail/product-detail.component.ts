import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  PLATFORM_ID,
  effect,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductSeoService } from '../../core/services/product-seo.service';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductVariant } from '../../core/models/product.model';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { ProductDetailSkeletonComponent } from '../../shared/components/product-detail-skeleton/product-detail-skeleton.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { logError } from '../../shared/utils/log.util';
import { ImageGalleryComponent } from '../../shared/components/image-gallery/image-gallery.component';
import { QtySelectorComponent } from '../../shared/components/qty-selector/qty-selector.component';
import { RelatedProductsComponent } from '../../shared/components/related-products/related-products.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { presentationPrice, toCartItem } from '../../core/lib/product-purchase';
import { findLandingVariant } from '../../core/lib/landing-variants';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyArsPipe,
    ProductDetailSkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    ImageGalleryComponent,
    QtySelectorComponent,
    RelatedProductsComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product = signal<Product | null>(null);
  allProducts = inject(ProductsService).products;
  loading = signal(true);
  /** 'not-found': el producto no existe (404). 'network': la API no respondió (se puede reintentar). */
  error = signal<'not-found' | 'network' | null>(null);
  private lastRequest: { slug: string; variant: string | null } | null = null;

  selectedVariant = signal<ProductVariant | null>(null);
  quantity = signal(1);
  added = signal(false);
  // Solo se completa al entrar desde una línea puntual del carrito mediante
  // el segmento /:variant; nunca se deriva del fallback de una única línea.
  editSourceVariantId = signal<string | null>(null);

  // Precios dinámicos devueltos por el backend
  dynamicPriceArs = signal<number>(0);
  dynamicPriceUsd = signal<number>(0);

  private api = inject(ApiService);
  private cart = inject(CartService);
  private productsService = inject(ProductsService);
  public pricingConfigService = inject(PricingConfigService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(ProductSeoService);
  private platformId = inject(PLATFORM_ID);
  private priceDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Mantenemos la estructura para minimizar cambios en el HTML
  currentPricing = computed(() => ({
    finalPriceArs: this.dynamicPriceArs(),
    finalPriceUsd: this.dynamicPriceUsd(),
  }));

  breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const p = this.product();
    const items: BreadcrumbItem[] = [
      { label: 'Productos', link: '/productos' },
    ];
    if (p?.category?.parent) {
      items.push({
        label: p.category.parent.name,
        link: `/categorias/${p.category.parent.slug}`,
      });
    }
    if (p?.category) {
      items.push({
        label: p.category.name,
        link: `/categorias/${p.category.slug}`,
      });
    }
    items.push({ label: p?.name ?? '' });
    return items;
  });

  relatedProducts = computed(() => {
    const current = this.product();
    if (!current) return [];
    return this.allProducts()
      .filter((p) => p.id !== current.id)
      .slice(0, 4);
  });

  hasCurrentProductInCart = computed(() => {
    const v = this.selectedVariant();
    if (!v) return false;
    return this.cart.cartItems().some((item) => item.variantId === v.id);
  });

  get inStock(): boolean {
    return this.maxQty > 0;
  }

  /** Packs que todavía se pueden agregar: stock del producto menos lo que ya está en el carrito
   *  (todas sus presentaciones). */
  get maxQty(): number {
    const p = this.product();
    const v = this.selectedVariant();
    if (!p || !v) return 0;
    return this.cart.remainingPacksOf(p, v);
  }

  constructor() {
    // Efecto para actualizar el precio cuando cambia la variante o la cantidad
    effect(
      () => {
        const v = this.selectedVariant();
        const q = this.quantity();
        const p = this.product();
        this.cart.cartItems();

        if (v && p) {
          this.scheduleDynamicPriceUpdate(v.id, q);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const landing = findLandingVariant(slug, Number(params.get('variant')));
      if (landing) {
        void this.router.navigateByUrl(landing.path, { replaceUrl: true });
        return;
      }
      this.loadProduct(slug, params.get('variant'));
    });
    this.loadAllProducts();
  }

  /**
   * Obtiene el precio actualizado desde el backend considerando descuentos por volumen.
   */
  private scheduleDynamicPriceUpdate(variantId: string, qty: number): void {
    if (this.priceDebounceTimer) {
      clearTimeout(this.priceDebounceTimer);
    }

    this.priceDebounceTimer = setTimeout(() => {
      this.updateDynamicPrice(variantId, qty);
    }, 350);
  }

  updateDynamicPrice(variantId: string, qty: number): void {
    const p = this.product();
    const v = this.selectedVariant();
    if (!p || !v || v.id !== variantId) return;

    const result = presentationPrice(
      p,
      v,
      qty + this.cart.quantityOf(variantId),
      this.pricingConfigService.pricingConfig(),
    );

    this.dynamicPriceArs.set(result.price_ars);
    this.dynamicPriceUsd.set(result.price_usd);
  }

  /** Al salir de la ficha, sus datos estructurados no deben quedar en el <head> de otra página. */
  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.priceDebounceTimer) clearTimeout(this.priceDebounceTimer);
    this.seo.clearStructuredData();
  }

  retryLoad(): void {
    if (this.lastRequest)
      this.loadProduct(this.lastRequest.slug, this.lastRequest.variant);
  }

  loadProduct(slug: string, presentationParam: string | null = null): void {
    this.lastRequest = { slug, variant: presentationParam };
    this.error.set(null);
    this.product.set(null);
    this.loading.set(true);
    this.api.get<Product>(`/products/${slug}`).subscribe({
      next: (raw) => {
        const data: Product = {
          ...raw,
          variants: (raw.variants ?? []).filter(
            (v) => !findLandingVariant(raw.slug, v.units_per_pack),
          ),
        };
        this.product.set(data);
        const presentation = presentationParam?.trim()
          ? Number(presentationParam)
          : NaN;
        // units_per_pack es la presentación legible de la URL. Si hubiera duplicados,
        // .find() toma deliberadamente la primera variante del catálogo.
        const matchedVariant = Number.isFinite(presentation)
          ? (data.variants?.find(
              (variant) => variant.units_per_pack === presentation,
            ) ?? null)
          : null;
        this.seo.setProductPage(data, slug, matchedVariant);

        this.pricingConfigService.setPricingConfig(data.pricing_config);
        const firstVariant = data.variants?.[0] ?? null;
        const cartItemsForProduct = this.cart
          .cartItems()
          .filter((item) => item.productId === data.id);
        const editSourceVariantId =
          matchedVariant &&
          cartItemsForProduct.some(
            (item) => item.variantId === matchedVariant.id,
          )
            ? matchedVariant.id
            : null;
        const fallbackCartItem =
          cartItemsForProduct.length === 1 ? cartItemsForProduct[0] : undefined;
        const selectedVariant =
          matchedVariant ??
          (fallbackCartItem
            ? data.variants?.find(
                (variant) => variant.id === fallbackCartItem.variantId,
              )
            : undefined) ??
          firstVariant;

        this.editSourceVariantId.set(editSourceVariantId);

        this.selectedVariant.set(selectedVariant);
        if (selectedVariant) {
          this.dynamicPriceArs.set(selectedVariant.price_ars || 0);
          this.dynamicPriceUsd.set(selectedVariant.price_usd || 0);
        }
        this.quantity.set(1);
        this.loading.set(false);
        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo(0, 0);
        }
      },
      error: (err: { status?: number }) => {
        this.error.set(err?.status === 404 ? 'not-found' : 'network');
        this.seo.setErrorTitle(err?.status === 404);
        this.loading.set(false);
      },
    });
  }

  loadAllProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.pricingConfigService.setPricingConfig(
          products?.[0]?.pricing_config,
        );
      },
      error: (err) => logError('Error loading related products', err),
    });
  }

  selectVariant(v: ProductVariant): void {
    const from = this.editSourceVariantId();
    const sourceItem = from
      ? this.cart.cartItems().find((item) => item.variantId === from)
      : undefined;

    if (from && from !== v.id && sourceItem) {
      void this.cart.changeVariant(from, {
        variantId: v.id,
        sku: v.sku,
        stock: v.stock,
        units_per_pack: v.units_per_pack,
        cost_usd: v.cost_usd,
        has_packaging: v.has_packaging,
      });
      this.editSourceVariantId.set(v.id);
      this.quantity.set(1);
    } else if (!sourceItem) {
      this.editSourceVariantId.set(null);
      this.quantity.set(1);
    }

    this.selectedVariant.set(v);
  }

  decrement(): void {
    if (this.quantity() > 1) this.quantity.update((q) => q - 1);
  }

  increment(): void {
    if (this.quantity() < this.maxQty) this.quantity.update((q) => q + 1);
  }

  addToCart(): void {
    const p = this.product();
    const v = this.selectedVariant();
    if (!p || !v || !this.inStock) return;
    if (this.quantity() > this.maxQty) this.quantity.set(this.maxQty);

    this.cart.add(
      toCartItem(p, v, {
        quantity: this.quantity(),
        price_ars: this.dynamicPriceArs(),
        price_usd: this.dynamicPriceUsd(),
      }),
    );

    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }
}
