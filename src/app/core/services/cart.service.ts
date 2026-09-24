import {
  Injectable,
  signal,
  computed,
  PLATFORM_ID,
  inject,
  effect,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem, GroupedCartItem } from '../models/cart.model';
import { PricingConfigService } from './pricing-config.service';
import { PaymentMethodService } from './payment-method.service';
import { PackagingService } from './packaging.service';
import { ShippingService } from './shipping.service';
import { CartCatalogService, availableVariantIds } from './cart-catalog.service';
import { groupCartItems, priceLine, repriceCart } from '../lib/cart-pricing';
import { estimateStockUnits, remainingPacks } from '../lib/cart-stock';
import { Product, ProductVariant } from '../models/product.model';
import { logError } from '../../shared/utils/log.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Estado del carrito (líneas, guardado en localStorage) y sus totales.
// POR QUÉ:  Los precios se calculan en lib/cart-pricing.ts, las cuentas de stock en
//           lib/cart-stock.ts y lo que viene del backend (dólar, catálogo, stock) en
//           CartCatalogService. Acá solo se coordinan.
// ─────────────────────────────────────────────────────────────

const CART_KEY = 'cart_items';

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['variantId'] === 'string' &&
    typeof v['productId'] === 'string' &&
    typeof v['quantity'] === 'number' &&
    v['quantity'] > 0
  );
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pricingConfigService = inject(PricingConfigService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly shippingService = inject(ShippingService);
  private readonly packagingService = inject(PackagingService);
  private readonly catalog = inject(CartCatalogService);

  private readonly items = signal<CartItem[]>([]);

  readonly cartItems = this.items.asReadonly();
  readonly dolarOficial = this.catalog.dolarOficial;
  /** Nombres de lo que se sacó del carrito porque ya no está en el catálogo (para avisarle al cliente). */
  readonly removedItems = signal<string[]>([]);

  readonly itemCount = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0),
  );

  readonly isEmpty = computed(() => this.items().length === 0);

  readonly totalUsd = computed(() =>
    this.items().reduce((sum, i) => sum + (i.price_usd || 0) * i.quantity, 0),
  );

  readonly subtotalArs = computed(() =>
    this.items().reduce((sum, i) => sum + (i.price_ars || 0) * i.quantity, 0),
  );

  readonly shippingArs = computed(
    () => this.shippingService.shippingCost() ?? 0,
  );
  /** Los precios de lista ya incluyen el costo de Mercado Pago; la transferencia recibe este descuento. */
  readonly paymentDiscountPercentage = computed(() =>
    this.paymentMethodService.current() === 'transferencia'
      ? this.pricingConfigService.paymentCommissionPercentage()
      : 0,
  );
  // El embalaje ya está adentro de subtotalArs (repartido en item.price_ars por
  // recalculateAllPrices), no se suma aparte acá.
  readonly paymentDiscountArs = computed(() =>
    Math.round(
      ((this.subtotalArs() + this.shippingArs()) *
        this.paymentDiscountPercentage()) /
        100,
    ),
  );
  readonly totalAPagar = computed(
    () => this.subtotalArs() + this.shippingArs() - this.paymentDiscountArs(),
  );
  readonly subtotalSinDescuentoArs = computed(() =>
    this.groupedCartItems().reduce(
      (sum, item) => sum + item.subtotalArsNoDiscount,
      0,
    ),
  );

  readonly groupedCartItems = computed<GroupedCartItem[]>(() =>
    groupCartItems(
      this.items(),
      this.pricingConfigService.pricingConfig(),
      this.packagingService.embalajeByProduct(),
    ),
  );

  /** Descuento real sobre los productos: se deriva de los dos importes que se
   *  muestran (subtotal de lista vs. subtotal con descuento), así el % siempre
   *  coincide con los números en pantalla. */
  readonly volumeDiscountPercentage = computed(() => {
    const listSubtotal = this.subtotalSinDescuentoArs();
    if (listSubtotal <= 0) return 0;
    return Math.max(
      0,
      Math.round((1 - this.subtotalArs() / listSubtotal) * 100),
    );
  });

  readonly totalVolumeCc = computed(() =>
    this.items().reduce(
      (sum, i) =>
        sum + (i.volume_cc || 0) * (i.units_per_pack || 1) * i.quantity,
      0,
    ),
  );

  constructor() {
    if (this.isBrowser) {
      this.loadFromStorage();
      void this.catalog.refreshExchangeRate();
      // Un carrito guardado puede tener productos que se borraron del catálogo.
      if (this.items().length > 0) void this.refreshPricing();
    }

    effect(
      () => {
        const rate = this.dolarOficial();
        if (rate > 0) {
          untracked(() => {
            this.recalculateAllPrices();
          });
        }
      },
      { allowSignalWrites: true },
    );

    // El embalaje de cada producto (sus propias cajas) depende de todo el carrito, así que
    // llega por red (PackagingService) y no al instante: cuando la cotización cambia, se
    // reparte de nuevo en el precio de cada línea.
    effect(
      () => {
        this.packagingService.embalajeByProduct();
        untracked(() => {
          this.recalculateAllPrices();
        });
      },
      { allowSignalWrites: true },
    );
  }

  async add(item: CartItem): Promise<void> {
    const current = this.items();
    const existing = current.find((i) => i.variantId === item.variantId);
    const newQuantity = existing
      ? existing.quantity + item.quantity
      : item.quantity;
    const updatedPricing = priceLine(
      item,
      { unitsPerPack: item.units_per_pack, hasPackaging: item.has_packaging },
      newQuantity,
      this.pricingConfigService.pricingConfig(),
    );

    if (existing) {
      this.items.set(
        current.map((i) =>
          i.variantId === item.variantId
            ? { ...i, ...item, ...updatedPricing, quantity: newQuantity }
            : i,
        ),
      );
    } else {
      this.items.set([
        ...current,
        { ...item, ...updatedPricing, quantity: newQuantity },
      ]);
    }

    this.saveToStorage();
    await this.recalculateAllPrices();
  }

  remove(variantId: string): void {
    this.items.set(this.items().filter((i) => i.variantId !== variantId));
    this.saveToStorage();
    void this.recalculateAllPrices();
  }

  async updateQuantity(variantId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      this.remove(variantId);
      return;
    }

    const item = this.items().find((i) => i.variantId === variantId);
    if (!item) return;

    this.items.set(
      this.items().map((i) =>
        i.variantId === variantId ? { ...i, quantity } : i,
      ),
    );
    this.saveToStorage();

    await this.recalculateAllPrices();
  }

  async changeVariant(
    fromVariantId: string,
    toVariant: {
      variantId: string;
      sku: string;
      stock: number;
      units_per_pack: number;
      cost_usd?: number;
      has_packaging?: boolean;
    },
  ): Promise<void> {
    if (fromVariantId === toVariant.variantId) return;

    const current = this.items();
    const source = current.find((item) => item.variantId === fromVariantId);
    if (!source) return;

    const destination = current.find(
      (item) => item.variantId === toVariant.variantId,
    );
    const quantity = destination
      ? destination.quantity + source.quantity
      : source.quantity;
    const updatedPricing = priceLine(
      destination ?? source,
      { unitsPerPack: toVariant.units_per_pack, hasPackaging: toVariant.has_packaging },
      quantity,
      this.pricingConfigService.pricingConfig(),
    );

    if (destination) {
      this.items.set(
        current
          .filter((item) => item.variantId !== fromVariantId)
          .map((item) =>
            item.variantId === toVariant.variantId
              ? { ...item, quantity, ...updatedPricing }
              : item,
          ),
      );
    } else {
      this.items.set(
        current.map((item) =>
          item.variantId === fromVariantId
            ? {
                ...item,
                variantId: toVariant.variantId,
                sku: toVariant.sku,
                stock: toVariant.stock,
                units_per_pack: toVariant.units_per_pack,
                cost_usd: toVariant.cost_usd ?? item.cost_usd,
                has_packaging: toVariant.has_packaging,
                quantity,
                ...updatedPricing,
              }
            : item,
        ),
      );
    }

    this.saveToStorage();
    await this.recalculateAllPrices();
  }

  clear(): void {
    this.items.set([]);
    this.saveToStorage();
  }

  /**
   * Vuelve a pedir la configuración de precios al backend y recalcula el
   * carrito. Los precios se calculan en el navegador con esa configuración, que
   * solo se actualizaba al visitar una ficha de producto: si cambió el dólar, el
   * markup o un descuento, el total mostrado podía diferir del cobrado.
   *
   * Con el mismo pedido saca del carrito las presentaciones que ya no están en el
   * catálogo (producto o presentación borrados/desactivados): con ellas el backend
   * rechaza la cotización del embalaje y el botón de pagar quedaría esperando.
   */
  async refreshPricing(): Promise<void> {
    try {
      const response = await this.catalog.fetchCatalog();
      this.removeUnavailableItems(availableVariantIds(response));
      if (!response.pricing_config) return;
      this.pricingConfigService.setPricingConfig(response.pricing_config);
      await this.recalculateAllPrices();
    } catch (e) {
      logError('Error al actualizar los precios:', e);
    }
  }

  /**
   * Packs de esa presentación que todavía entran en el stock del producto, descontando lo
   * que ya está en el carrito (todas sus presentaciones, salvo `excludeVariantId`).
   * Sin dato de stock devuelve Infinity: el backend igual valida al pagar.
   */
  remainingPacks(
    productId: string,
    unitsPerPack: number,
    stockUnits: number | undefined = this.catalog.stockUnitsOf(productId),
    excludeVariantId?: string,
  ): number {
    return remainingPacks(this.items(), productId, unitsPerPack, stockUnits, excludeVariantId);
  }

  /** Packs de esa presentación que todavía se pueden agregar desde la ficha o una landing,
   *  con el stock que trae el producto (todas sus presentaciones). */
  remainingPacksOf(product: Product, variant: ProductVariant): number {
    return this.remainingPacks(
      product.id,
      Number(variant.units_per_pack) || 1,
      estimateStockUnits(product.variants ?? []),
    );
  }

  /** Packs de esa presentación que ya están en el carrito. */
  quantityOf(variantId: string): number {
    return this.items().find((i) => i.variantId === variantId)?.quantity ?? 0;
  }

  /** Cantidad máxima de una línea del carrito según el stock del producto. */
  maxQuantityFor(item: CartItem): number {
    return this.remainingPacks(
      item.productId,
      item.units_per_pack || 1,
      undefined,
      item.variantId,
    );
  }

  /** `available` null: no se sabe qué existe (catálogo incompleto), no se saca nada. */
  private removeUnavailableItems(available: Set<string> | null): void {
    if (!available) return;
    const current = this.items();
    const kept = current.filter((i) => available.has(i.variantId));
    if (kept.length === current.length) return;

    this.removedItems.set(
      current.filter((i) => !available.has(i.variantId)).map((i) => i.productName),
    );
    this.items.set(kept);
    this.saveToStorage();
  }

  private async recalculateAllPrices(): Promise<void> {
    const currentItems = this.items();
    if (currentItems.length === 0) return;

    this.items.set(
      repriceCart(
        currentItems,
        this.pricingConfigService.pricingConfig(),
        this.packagingService.embalajeByProduct(),
      ),
    );
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (this.isBrowser) {
      localStorage.setItem(CART_KEY, JSON.stringify(this.items()));
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.items.set(Array.isArray(parsed) ? parsed.filter(isCartItem) : []);
      }
    } catch (e) {
      logError('Error al cargar carrito del storage:', e);
      this.items.set([]);
    }
  }
}
