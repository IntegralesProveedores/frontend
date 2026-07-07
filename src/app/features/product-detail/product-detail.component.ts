import { Component, OnInit, signal, computed, inject, PLATFORM_ID, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { Product, ProductVariant } from '../../core/models/product.model';
import { PaginatedResponse } from '../../core/models/api-response.model';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductDetailSkeletonComponent } from '../../shared/components/product-detail-skeleton/product-detail-skeleton.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ProgressiveImageComponent } from '../../shared/components/progressive-image/progressive-image.component';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { calculateLocalPrice } from '../../core/lib/pricing.util';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyArsPipe, ProductCardComponent, ProductDetailSkeletonComponent, ErrorStateComponent, ProgressiveImageComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product = signal<Product | null>(null);
  allProducts = signal<Product[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  selectedVariant = signal<ProductVariant | null>(null);
  selectedImageIndex = signal(0);
  quantity = signal(1);
  added = signal(false);

  // Precios dinámicos devueltos por el backend
  dynamicPriceArs = signal<number>(0);
  dynamicPriceUsd = signal<number>(0);

  private api = inject(ApiService);
  private cart = inject(CartService);
  private pricingConfigService = inject(PricingConfigService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
      
      if (v && p) {
        this.scheduleDynamicPriceUpdate(v.id, q);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.loadProduct(slug);
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

  loadProduct(slug: string): void {
    this.loading.set(true);
    this.api.get<Product>(`/products/${slug}`).subscribe({
      next: data => {
        this.product.set(data);
        this.pricingConfigService.setPricingConfig(data.pricing_config);
        const firstVariant = data.variants?.[0] ?? null;
        this.selectedVariant.set(firstVariant);
        if (firstVariant) {
          this.dynamicPriceArs.set(firstVariant.price_ars || 0);
          this.dynamicPriceUsd.set(firstVariant.price_usd || 0);
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
    this.api.get<PaginatedResponse<Product>>('/products').subscribe({
      next: data => {
        this.allProducts.set(data.items);
        this.pricingConfigService.setPricingConfig(data.items?.[0]?.pricing_config);
      },
      error: err => console.error('Error loading related products', err)
    });
  }

  selectVariant(v: ProductVariant): void {
    this.selectedVariant.set(v);
    this.quantity.set(1);
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  decrement(): void {
    if (this.quantity() > 1) this.quantity.update(q => q - 1);
  }

  increment(): void {
    if (this.quantity() < this.maxQty) this.quantity.update(q => q + 1);
  }

  setQuantity(value: number): void {
    const clamped = Math.max(1, Math.min(value, this.maxQty));
    this.quantity.set(clamped);
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

  goToCart(): void {
    this.router.navigate(['/cart']);
  }
}


