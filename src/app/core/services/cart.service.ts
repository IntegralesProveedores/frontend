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
import { firstValueFrom } from 'rxjs';
import { CartItem, GroupedCartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { PricingConfigService } from './pricing-config.service';
import {
  calculateLocalPrice,
  calculateLocalPriceNoDiscount,
  cartVolumeDiscount,
  embalajePerPackArs,
} from '../lib/pricing.util';
import { PaymentMethodService } from './payment-method.service';
import { PackagingService } from './packaging.service';
import { ShippingService } from './shipping.service';
import { PricingConfig, Product } from '../models/product.model';
import { PaginatedResponse } from '../models/api-response.model';
import { logError } from '../../shared/utils/log.util';

const CART_KEY = 'cart_items';

/**
 * Unidades en stock de un producto a partir de sus presentaciones: la API da el stock de
 * cada una en packs (stock_units ÷ unidades del pack, redondeado para abajo), así que la
 * presentación más chica es la que mejor aproxima el stock en unidades.
 */
export function estimateStockUnits(
  variants: Array<{ stock?: number; units_per_pack?: number }>,
): number {
  return variants.reduce(
    (max, v) =>
      Math.max(max, (Number(v.stock) || 0) * (Number(v.units_per_pack) || 1)),
    0,
  );
}
/** Máximo que acepta GET /products por página. */
const CATALOG_PAGE_LIMIT = 50;

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
  private readonly apiService = inject(ApiService);
  private readonly pricingConfigService = inject(PricingConfigService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly shippingService = inject(ShippingService);
  private readonly packagingService = inject(PackagingService);

  private readonly items = signal<CartItem[]>([]);
  private readonly dolarVenta = signal<number>(0);

  readonly cartItems = this.items.asReadonly();
  readonly dolarOficial = this.dolarVenta.asReadonly();
  /** Nombres de lo que se sacó del carrito porque ya no está en el catálogo (para avisarle al cliente). */
  readonly removedItems = signal<string[]>([]);
  /** Unidades en stock de cada producto según el último catálogo pedido (el stock es por
   *  unidades del producto, no por presentación). */
  private readonly productStockUnits = signal<Map<string, number>>(new Map());

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

  readonly groupedCartItems = computed<GroupedCartItem[]>(() => {
    const map = new Map<string, GroupedCartItem>();
    const config = this.pricingConfigService.pricingConfig();
    // Mismo reparto de embalaje que recalculateAllPrices, para que el "Subtotal" (precio de
    // lista, sin descuento) también lo incluya: si no, el % de descuento mostrado queda mal
    // (el embalaje no se descuenta por volumen, pero tiene que estar en los dos lados).
    const productUnits = new Map<string, number>();
    for (const item of this.items()) {
      const units = (item.units_per_pack || 1) * item.quantity;
      productUnits.set(
        item.productId,
        (productUnits.get(item.productId) ?? 0) + units,
      );
    }
    const embalajeByProduct = this.packagingService.embalajeByProduct();

    for (const item of this.items()) {
      const unitsPerPack = item.units_per_pack || 1;
      const totalUnits = unitsPerPack * item.quantity;
      const subtotal = (item.price_ars || 0) * item.quantity;
      const embalajeAdd = embalajePerPackArs(
        embalajeByProduct.get(item.productId) ?? 0,
        productUnits.get(item.productId) ?? 0,
        unitsPerPack,
      );
      const noDiscount =
        config &&
        item.cost_usd_master &&
        item.units_per_pack_master &&
        unitsPerPack
          ? calculateLocalPriceNoDiscount(
              Number(item.cost_usd_master),
              Number(item.units_per_pack_master),
              unitsPerPack,
              item.quantity,
              item.cost_currency,
              config,
              item.has_packaging,
            )
          : { price_ars: item.price_ars || 0 };
      const subtotalNoDiscount =
        (noDiscount.price_ars + embalajeAdd) * item.quantity;
      const existing = map.get(item.productId);
      if (existing) {
        existing.totalUnits += totalUnits;
        existing.totalQuantity += item.quantity;
        existing.subtotalArs += subtotal;
        existing.subtotalArsNoDiscount += subtotalNoDiscount;
        existing.presentations.push({
          variantId: item.variantId,
          units_per_pack: unitsPerPack,
          quantity: item.quantity,
        });
      } else {
        map.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          slug: item.slug,
          imageUrl: item.imageUrl,
          representativeUnitsPerPack: unitsPerPack,
          totalQuantity: item.quantity,
          totalUnits,
          subtotalArs: subtotal,
          unitPriceNoDiscountArs: noDiscount.price_ars + embalajeAdd,
          subtotalArsNoDiscount: subtotalNoDiscount,
          presentations: [
            {
              variantId: item.variantId,
              units_per_pack: unitsPerPack,
              quantity: item.quantity,
            },
          ],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aVolume =
        this.items().find((item) => item.productId === a.productId)
          ?.product_volume_cc ?? 0;
      const bVolume =
        this.items().find((item) => item.productId === b.productId)
          ?.product_volume_cc ?? 0;
      return aVolume - bVolume;
    });
  });

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
      this.refreshExchangeRate();
      // Un carrito guardado puede tener productos que se borraron del catálogo.
      if (this.items().length > 0) void this.refreshPricing();
    }

    effect(
      () => {
        const rate = this.dolarVenta();
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
    const config = this.pricingConfigService.pricingConfig();
    const canRecalculate =
      !!config &&
      !!item.cost_usd_master &&
      !!item.units_per_pack_master &&
      !!item.units_per_pack;
    const updatedPricing = canRecalculate
      ? calculateLocalPrice(
          Number(item.cost_usd_master) || 0,
          Number(item.units_per_pack_master) || 1,
          Number(item.units_per_pack) || 1,
          newQuantity,
          item.cost_currency,
          config,
          item.has_packaging,
        )
      : {
          price_ars: item.price_ars,
          price_usd: item.price_usd,
          price_sin_impuestos_ars: item.price_sin_impuestos_ars,
        };

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
    const config = this.pricingConfigService.pricingConfig();
    const quantity = destination
      ? destination.quantity + source.quantity
      : source.quantity;
    const pricingBase = destination ?? source;
    const updatedPricing =
      config &&
      pricingBase.cost_usd_master &&
      pricingBase.units_per_pack_master &&
      toVariant.units_per_pack
        ? calculateLocalPrice(
            Number(pricingBase.cost_usd_master) || 0,
            Number(pricingBase.units_per_pack_master) || 1,
            Number(toVariant.units_per_pack) || 1,
            quantity,
            pricingBase.cost_currency,
            config,
            toVariant.has_packaging,
          )
        : {
            price_ars: pricingBase.price_ars,
            price_usd: pricingBase.price_usd,
            price_sin_impuestos_ars: pricingBase.price_sin_impuestos_ars,
          };

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
   * El parámetro _t evita el caché de 60 s de /products.
   *
   * Con el mismo pedido saca del carrito las presentaciones que ya no están en el
   * catálogo (producto o presentación borrados/desactivados): con ellas el backend
   * rechaza la cotización del embalaje y el botón de pagar quedaría esperando.
   */
  async refreshPricing(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.apiService.get<PaginatedResponse<Product> & { pricing_config?: PricingConfig }>(
          '/products',
          { limit: String(CATALOG_PAGE_LIMIT), _t: String(Date.now()) },
        ),
      );
      this.updateStockFromCatalog(response.items ?? []);
      this.removeUnavailableItems(response);
      if (!response.pricing_config) return;
      this.pricingConfigService.setPricingConfig(response.pricing_config);
      await this.recalculateAllPrices();
    } catch (e) {
      logError('Error al actualizar los precios:', e);
    }
  }

  private updateStockFromCatalog(products: Product[]): void {
    const next = new Map(this.productStockUnits());
    for (const p of products) next.set(p.id, estimateStockUnits(p.variants ?? []));
    this.productStockUnits.set(next);
  }

  /**
   * Packs de esa presentación que todavía entran en el stock del producto, descontando lo
   * que ya está en el carrito (todas sus presentaciones, salvo `excludeVariantId`).
   * Sin dato de stock devuelve Infinity: el backend igual valida al pagar.
   */
  remainingPacks(
    productId: string,
    unitsPerPack: number,
    stockUnits: number | undefined = this.productStockUnits().get(productId),
    excludeVariantId?: string,
  ): number {
    if (stockUnits === undefined) return Infinity;
    const inCart = this.items()
      .filter((i) => i.productId === productId && i.variantId !== excludeVariantId)
      .reduce((sum, i) => sum + i.quantity * (i.units_per_pack || 1), 0);
    return Math.max(0, Math.floor((stockUnits - inCart) / (unitsPerPack || 1)));
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

  private removeUnavailableItems(catalog: PaginatedResponse<Product>): void {
    // Solo con el catálogo completo en una página: si no, faltarían productos que sí existen.
    if (catalog.pagination?.total_pages !== 1 || !Array.isArray(catalog.items)) return;
    const available = new Set(
      catalog.items.flatMap((p) => (p.variants ?? []).map((v) => v.id)),
    );
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

    const config = this.pricingConfigService.pricingConfig();
    const exchangeRate = config?.exchange_rate || 1;
    // El mayor tramo de descuento alcanzado por algún producto se aplica a todos.
    const cartDiscount = cartVolumeDiscount(
      currentItems.map((item) => ({
        unitsPerPack: Number(item.units_per_pack) || 1,
        quantity: item.quantity,
        unitsPerPackMaster: Number(item.units_per_pack_master) || 1,
      })),
      config,
    );
    // Unidades totales por producto en el carrito (todas sus presentaciones), para repartir
    // el embalaje de cada producto entre sus líneas (ver embalajePerPackArs).
    const productUnits = new Map<string, number>();
    for (const item of currentItems) {
      const units = (Number(item.units_per_pack) || 1) * item.quantity;
      productUnits.set(
        item.productId,
        (productUnits.get(item.productId) ?? 0) + units,
      );
    }
    const embalajeByProduct = this.packagingService.embalajeByProduct();

    const updates = currentItems.map((item) => {
      if (
        !config ||
        !item.cost_usd_master ||
        !item.units_per_pack_master ||
        !item.units_per_pack
      ) {
        return item;
      }

      const pricing = calculateLocalPrice(
        Number(item.cost_usd_master) || 0,
        Number(item.units_per_pack_master) || 1,
        Number(item.units_per_pack) || 1,
        item.quantity,
        item.cost_currency,
        config,
        item.has_packaging,
        cartDiscount,
      );
      const embalajeAdd = embalajePerPackArs(
        embalajeByProduct.get(item.productId) ?? 0,
        productUnits.get(item.productId) ?? 0,
        Number(item.units_per_pack) || 1,
      );
      const price_ars = pricing.price_ars + embalajeAdd;
      return {
        ...item,
        price_ars,
        price_usd: Math.round((price_ars / exchangeRate) * 100) / 100,
        price_sin_impuestos_ars:
          pricing.price_sin_impuestos_ars + embalajeAdd,
      };
    });

    this.items.set(updates);
    this.saveToStorage();
  }

  private async refreshExchangeRate() {
    try {
      const settings = await firstValueFrom(this.apiService.getSettings());
      if (settings?.usd_exchange_rate) {
        this.dolarVenta.set(settings.usd_exchange_rate);
        const config = this.pricingConfigService.pricingConfig();
        if (config) {
          this.pricingConfigService.setPricingConfig({
            ...config,
            exchange_rate: settings.usd_exchange_rate,
          });
        }
      }
    } catch (e) {
      logError('Error al obtener configuracion del backend:', e);
    }
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
