import { Component, OnInit, signal, computed, inject, PLATFORM_ID, effect, Renderer2 } from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductVariant } from '../../core/models/product.model';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductDetailSkeletonComponent } from '../../shared/components/product-detail-skeleton/product-detail-skeleton.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ProgressiveImageComponent } from '../../shared/components/progressive-image/progressive-image.component';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { calculateLocalPrice } from '../../core/lib/pricing.util';

interface ProductJsonLd {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
  image?: string;
  sku?: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers:
    | {
        '@type': 'Offer';
        priceCurrency: 'ARS';
        price: number;
        availability: string;
      }
    | {
        '@type': 'AggregateOffer';
        priceCurrency: 'ARS';
        lowPrice: number;
        highPrice: number;
        offerCount: number;
        availability: string;
      };
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyArsPipe, ProductCardComponent, ProductDetailSkeletonComponent, ErrorStateComponent, ProgressiveImageComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product = signal<Product | null>(null);
  allProducts = inject(ProductsService).products;
  loading = signal(true);
  error = signal<string | null>(null);

  selectedVariant = signal<ProductVariant | null>(null);
  selectedImageIndex = signal(0);
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
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private document = inject(DOCUMENT);
  private renderer = inject(Renderer2);
  private platformId = inject(PLATFORM_ID);
  private priceDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Mantenemos la estructura para minimizar cambios en el HTML
  currentPricing = computed(() => ({
    finalPriceArs: this.dynamicPriceArs(),
    finalPriceUsd: this.dynamicPriceUsd()
  }));

  relatedProducts = computed(() => {
    const current = this.product();
    if (!current) return [];
    return this.allProducts()
      .filter(p => p.id !== current.id)
      .slice(0, 4);
  });

	hasCurrentProductInCart = computed(() => {
	  const v = this.selectedVariant();
	  if (!v) return false;
	  return this.cart.cartItems().some(item => item.variantId === v.id);
	});


  get mainImage(): string {
    const imgs = this.product()?.images ?? [];
    return imgs[this.selectedImageIndex()]?.url ?? '';
  }

  get inStock(): boolean {
    return (this.selectedVariant()?.stock ?? 0) > 0;
  }

  get maxQty(): number {
    return this.selectedVariant()?.stock ?? 1;
  }

  constructor() {
    // Efecto para actualizar el precio cuando cambia la variante o la cantidad
    effect(() => {
      const v = this.selectedVariant();
      const q = this.quantity();
      const p = this.product();
      this.cart.cartItems();
      
      if (v && p) {
        this.scheduleDynamicPriceUpdate(v.id, q);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
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

    const cartQty = this.cart.cartItems().find(i => i.variantId === variantId)?.quantity || 0;
    const totalQty = Math.max(1, qty + cartQty);
    const config = this.pricingConfigService.pricingConfig() ?? p.pricing_config;

    const result = calculateLocalPrice(
      Number(p.cost_usd) || 0,
      Number(p.units_per_pack_master) || 1,
      Number(v.units_per_pack) || 1,
      totalQty,
      config
    );

    this.dynamicPriceArs.set(result.price_ars);
    this.dynamicPriceUsd.set(result.price_usd);
  }

  private updateProductStructuredData(data: Product, metaDescription: string, absoluteImageUrl: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const scriptId = 'product-jsonld';
    const existingScript = this.document.getElementById(scriptId);
    if (existingScript?.parentNode) {
      existingScript.parentNode.removeChild(existingScript);
    }
    const existingBreadcrumb = this.document.getElementById('breadcrumb-jsonld');
    if (existingBreadcrumb?.parentNode) {
      existingBreadcrumb.parentNode.removeChild(existingBreadcrumb);
    }

    const variants = data.variants ?? [];
    const offerCount = variants.length;
    if (offerCount === 0) return;

    const stockAvailable = variants.some(v => (Number(v.stock) || 0) > 0);
    const availability = stockAvailable
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

    const baseSchema: ProductJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: data.name,
      description: metaDescription,
      sku: variants[0]?.sku,
      brand: {
        '@type': 'Brand',
        name: 'Brotalia'
      },
      offers: offerCount === 1
        ? {
            '@type': 'Offer',
            priceCurrency: 'ARS',
            price: Number(variants[0]?.price_ars) || 0,
            availability
          }
        : {
            '@type': 'AggregateOffer',
            priceCurrency: 'ARS',
            lowPrice: Math.min(...variants.map(v => Number(v.price_ars) || 0)),
            highPrice: Math.max(...variants.map(v => Number(v.price_ars) || 0)),
            offerCount,
            availability
          }
    };

    if (absoluteImageUrl) {
      baseSchema.image = absoluteImageUrl;
    }

    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', scriptId);
    this.renderer.appendChild(script, this.renderer.createText(JSON.stringify(baseSchema)));
    this.renderer.appendChild(this.document.head, script);

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://brotalia.com.ar/' },
        { '@type': 'ListItem', position: 2, name: 'Productos', item: 'https://brotalia.com.ar/productos' },
        { '@type': 'ListItem', position: 3, name: data.name, item: `https://brotalia.com.ar/productos/${data.slug}` }
      ]
    };
    const breadcrumbScript = this.renderer.createElement('script');
    this.renderer.setAttribute(breadcrumbScript, 'type', 'application/ld+json');
    this.renderer.setAttribute(breadcrumbScript, 'id', 'breadcrumb-jsonld');
    this.renderer.appendChild(breadcrumbScript, this.renderer.createText(JSON.stringify(breadcrumbSchema)));
    this.renderer.appendChild(this.document.head, breadcrumbScript);
  }

  loadProduct(slug: string, presentationParam: string | null = null): void {
    this.loading.set(true);
    this.api.get<Product>(`/products/${slug}`).subscribe({
      next: data => {
        this.product.set(data);
        const presentation = presentationParam?.trim() ? Number(presentationParam) : NaN;
        // units_per_pack es la presentación legible de la URL. Si hubiera duplicados,
        // .find() toma deliberadamente la primera variante del catálogo.
        const matchedVariant = Number.isFinite(presentation)
          ? data.variants?.find(variant => variant.units_per_pack === presentation) ?? null
          : null;
        const pageTitle = `Maceta Biodegradable ${data.name}${matchedVariant ? ` ${matchedVariant.units_per_pack} u.` : ''} | Brotalia`;
        const fallbackDescription = matchedVariant
          ? `Maceta biodegradable ${data.name} ${matchedVariant.units_per_pack} unidades, 100% compostable (turba, papel y cartón). Sin stress de trasplante, mayor crecimiento de raíces. Venta mayorista y minorista con envío a toda Argentina.`
          : `Maceta biodegradable ${data.name}, 100% compostable (turba, papel y cartón). Sin stress de trasplante, mayor crecimiento de raíces. Venta mayorista y minorista con envío a toda Argentina.`;
        const rawDescription = typeof data.description === 'string' ? data.description.trim() : '';
        const metaDescription = rawDescription.length > 0 ? rawDescription : fallbackDescription;
        const imageUrl = data.images?.[0]?.url ?? '';
        const absoluteImageUrl = imageUrl
          ? (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
            ? imageUrl
            : `https://brotalia.com.ar${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`)
          : '';

        this.titleService.setTitle(pageTitle);
        this.metaService.updateTag({ name: 'description', content: metaDescription });
        this.metaService.updateTag({ property: 'og:title', content: pageTitle });
        this.metaService.updateTag({ property: 'og:description', content: metaDescription });
        this.metaService.updateTag({ property: 'og:url', content: `https://brotalia.com.ar/productos/${slug}` });
        this.metaService.updateTag({ name: 'twitter:title', content: pageTitle });
        this.metaService.updateTag({ name: 'twitter:description', content: metaDescription });
        const existingCanonical = this.document.head.querySelector('link[rel="canonical"]');
        if (existingCanonical?.parentNode) {
          existingCanonical.parentNode.removeChild(existingCanonical);
        }
        const canonical = this.renderer.createElement('link');
        this.renderer.setAttribute(canonical, 'rel', 'canonical');
        this.renderer.setAttribute(canonical, 'href', `https://brotalia.com.ar/productos/${slug}`);
        this.renderer.appendChild(this.document.head, canonical);
        if (absoluteImageUrl) {
          this.metaService.updateTag({ property: 'og:image', content: absoluteImageUrl });
          this.metaService.updateTag({ name: 'twitter:image', content: absoluteImageUrl });
        }
        this.updateProductStructuredData(data, metaDescription, absoluteImageUrl);

        this.pricingConfigService.setPricingConfig(data.pricing_config);
        const firstVariant = data.variants?.[0] ?? null;
        const cartItemsForProduct = this.cart.cartItems().filter(item => item.productId === data.id);
        const editSourceVariantId = matchedVariant && cartItemsForProduct.some(
          item => item.variantId === matchedVariant.id
        )
          ? matchedVariant.id
          : null;
        const fallbackCartItem = cartItemsForProduct.length === 1 ? cartItemsForProduct[0] : undefined;
        const selectedVariant = matchedVariant
          ?? (fallbackCartItem
            ? data.variants?.find(variant => variant.id === fallbackCartItem.variantId)
            : undefined)
          ?? firstVariant;

        this.editSourceVariantId.set(editSourceVariantId);

        this.selectedVariant.set(selectedVariant);
        if (selectedVariant) {
          this.dynamicPriceArs.set(selectedVariant.price_ars || 0);
          this.dynamicPriceUsd.set(selectedVariant.price_usd || 0);
        }
        this.selectedImageIndex.set(0);
        this.quantity.set(1);
        this.loading.set(false);
        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo(0, 0);
        }
      },
      error: () => {
        this.error.set('Producto no encontrado.');
        this.loading.set(false);
      }
    });
  }

  loadAllProducts(): void {
    this.productsService.getProducts().subscribe({
      next: products => {
        this.pricingConfigService.setPricingConfig(products?.[0]?.pricing_config);
      },
      error: err => console.error('Error loading related products', err)
    });
  }

  selectVariant(v: ProductVariant): void {
    const from = this.editSourceVariantId();
    const sourceItem = from ? this.cart.cartItems().find(item => item.variantId === from) : undefined;

    if (from && from !== v.id && sourceItem) {
      void this.cart.changeVariant(from, {
        variantId: v.id,
        sku: v.sku,
        stock: v.stock,
        units_per_pack: v.units_per_pack,
        cost_usd: v.cost_usd
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
    if (this.quantity() > 1) this.quantity.update(q => q - 1);
  }

  increment(): void {
    if (this.quantity() < this.maxQty) this.quantity.update(q => q + 1);
  }

  addToCart(): void {
    const p = this.product();
    const v = this.selectedVariant();
    if (!p || !v || !this.inStock) return;

    this.cart.add({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      slug: p.slug,
      sku: v.sku,
      price_ars: this.dynamicPriceArs(),
      price_usd: this.dynamicPriceUsd(),
      cost_usd: v.cost_usd,
      cost_usd_master: p.cost_usd,
      quantity: this.quantity(),
      imageUrl: p.images?.[0]?.url ?? '',
      stock: v.stock,
      units_per_pack: v.units_per_pack,
      units_per_pack_master: p.units_per_pack_master,
      volume_cc: v.dimensions?.volume_cc
    });

    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }
}


