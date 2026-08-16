import { Injectable, signal, computed, PLATFORM_ID, inject, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CartItem, GroupedCartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { PricingConfigService } from './pricing-config.service';
import { calculateLocalPrice, calculateLocalPriceNoDiscount } from '../lib/pricing.util';
import { PaymentMethodService } from './payment-method.service';
import { ShippingService } from './shipping.service';

const CART_KEY = 'cart_items';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiService = inject(ApiService);
  private readonly pricingConfigService = inject(PricingConfigService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly shippingService = inject(ShippingService);

  private readonly items = signal<CartItem[]>([]);
  private readonly dolarVenta = signal<number>(0);
  private readonly priceRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly priceRefreshSeq = new Map<string, number>();

  readonly cartItems = this.items.asReadonly();
  readonly dolarOficial = this.dolarVenta.asReadonly();

  readonly itemCount = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly isEmpty = computed(() => this.items().length === 0);

  readonly totalUsd = computed(() =>
    this.items().reduce((sum, i) => sum + (i.price_usd || 0) * i.quantity, 0)
  );

  readonly subtotalArs = computed(() =>
    this.items().reduce((sum, i) => sum + (i.price_ars || 0) * i.quantity, 0)
  );

  readonly shippingArs = computed(() => this.shippingService.shippingCost() ?? 0);
  readonly paymentCommissionPercentage = computed(() => this.paymentMethodService.current() === 'transferencia' ? 0 : this.pricingConfigService.paymentCommissionPercentage());
  readonly paymentCommissionPercentage_MP = computed(() => this.pricingConfigService.paymentCommissionPercentage());
  readonly paymentCommissionArs = computed(() => Math.round((this.subtotalArs() + this.shippingArs()) * this.paymentCommissionPercentage() / 100));
  readonly totalConComision = computed(() => this.subtotalArs() + this.shippingArs() + this.paymentCommissionArs());
  readonly subtotalSinDescuentoArs = computed(() => this.groupedCartItems().reduce((sum, item) => sum + item.subtotalArsNoDiscount, 0));

  readonly groupedCartItems = computed<GroupedCartItem[]>(() => {
    const map = new Map<string, GroupedCartItem>();
    for (const item of this.items()) {
      const unitsPerPack = item.units_per_pack || 1;
      const totalUnits = unitsPerPack * item.quantity;
      const subtotal = (item.price_ars || 0) * item.quantity;
      const config = this.pricingConfigService.pricingConfig();
      const noDiscount = config && item.cost_usd_master && item.units_per_pack_master && unitsPerPack
        ? calculateLocalPriceNoDiscount(Number(item.cost_usd_master), Number(item.units_per_pack_master), unitsPerPack, item.quantity, item.cost_currency, config)
        : { price_ars: item.price_ars || 0 };
      const subtotalNoDiscount = noDiscount.price_ars * item.quantity;
      const existing = map.get(item.productId);
      if (existing) {
        existing.totalUnits += totalUnits;
        existing.totalQuantity += item.quantity;
        existing.subtotalArs += subtotal;
        existing.subtotalArsNoDiscount += subtotalNoDiscount;
        existing.presentations.push({ variantId: item.variantId, units_per_pack: unitsPerPack, quantity: item.quantity });
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
          unitPriceNoDiscountArs: noDiscount.price_ars,
          subtotalArsNoDiscount: subtotalNoDiscount,
          presentations: [{ variantId: item.variantId, units_per_pack: unitsPerPack, quantity: item.quantity }]
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aVolume = this.items().find(item => item.productId === a.productId)?.product_volume_cc ?? 0;
      const bVolume = this.items().find(item => item.productId === b.productId)?.product_volume_cc ?? 0;
      return aVolume - bVolume;
    });
  });

  readonly volumeDiscountPercentage = computed(() => {
    const config = this.pricingConfigService.pricingConfig();
    const discounts = [...(config?.volume_discounts ?? [])].sort((a, b) => b.min - a.min);
    if (discounts.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const i of this.items()) {
      if (!i.units_per_pack || !i.units_per_pack_master) continue;

      const equivalentPacks = (i.units_per_pack * i.quantity) / i.units_per_pack_master;
      const discountEntry = discounts.find(d => equivalentPacks >= d.min);
      const factor = discountEntry ? discountEntry.factor : 1;
      if (factor <= 1) continue;

      const weight = (i.price_ars || 0) * i.quantity;
      weightedSum += (factor - 1) * 100 * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 0;
    return Math.round(weightedSum / totalWeight);
  });

  readonly totalVolumeCc = computed(() =>
    this.items().reduce((sum, i) =>
      sum + ((i.volume_cc || 0) * (i.units_per_pack || 1) * i.quantity), 0
    )
  );

  constructor() {
    if (this.isBrowser) {
      this.loadFromStorage();
      this.refreshExchangeRate();
    }

    effect(() => {
      const rate = this.dolarVenta();
      if (rate > 0) {
        untracked(() => {
          this.recalculateAllPrices();
        });
      }
    }, { allowSignalWrites: true });
  }

  async add(item: CartItem): Promise<void> {
    const current = this.items();
    const existing = current.find(i => i.variantId === item.variantId);
    const newQuantity = existing ? existing.quantity + item.quantity : item.quantity;
    const config = this.pricingConfigService.pricingConfig();
    const canRecalculate = !!config && !!item.cost_usd_master && !!item.units_per_pack_master && !!item.units_per_pack;
    const updatedPricing = canRecalculate
      ? calculateLocalPrice(
          Number(item.cost_usd_master) || 0,
          Number(item.units_per_pack_master) || 1,
          Number(item.units_per_pack) || 1,
          newQuantity,
          item.cost_currency,
          config
        )
      : { price_ars: item.price_ars, price_usd: item.price_usd, price_sin_impuestos_ars: item.price_sin_impuestos_ars };

    if (existing) {
      this.items.set(current.map(i =>
        i.variantId === item.variantId ? { ...i, ...item, ...updatedPricing, quantity: newQuantity } : i
      ));
    } else {
      this.items.set([...current, { ...item, ...updatedPricing, quantity: newQuantity }]);
    }

    this.saveToStorage();
  }

  remove(variantId: string): void {
    this.items.set(this.items().filter(i => i.variantId !== variantId));
    this.saveToStorage();
  }

  async updateQuantity(variantId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      this.remove(variantId);
      return;
    }

    const item = this.items().find(i => i.variantId === variantId);
    if (!item) return;

    this.items.set(this.items().map(i =>
      i.variantId === variantId ? { ...i, quantity } : i
    ));
    this.saveToStorage();

    const requestSeq = (this.priceRefreshSeq.get(variantId) ?? 0) + 1;
    this.priceRefreshSeq.set(variantId, requestSeq);

    const previousTimer = this.priceRefreshTimers.get(variantId);
    if (previousTimer) clearTimeout(previousTimer);

    const timer = setTimeout(() => {
      if (this.priceRefreshSeq.get(variantId) !== requestSeq) {
        return;
      }

      const config = this.pricingConfigService.pricingConfig();
      if (!config || !item.cost_usd_master || !item.units_per_pack_master || !item.units_per_pack) {
        return;
      }

      const updatedPricing = calculateLocalPrice(
        Number(item.cost_usd_master) || 0,
        Number(item.units_per_pack_master) || 1,
        Number(item.units_per_pack) || 1,
        quantity,
        item.cost_currency,
        config
      );

      this.items.set(this.items().map(i =>
        i.variantId === variantId ? { ...i, ...updatedPricing, quantity } : i
      ));
      this.saveToStorage();
    }, 350);

    this.priceRefreshTimers.set(variantId, timer);
  }

  async changeVariant(
    fromVariantId: string,
    toVariant: {
      variantId: string;
      sku: string;
      stock: number;
      units_per_pack: number;
      cost_usd?: number;
    }
  ): Promise<void> {
    if (fromVariantId === toVariant.variantId) return;

    for (const variantId of [fromVariantId, toVariant.variantId]) {
      const timer = this.priceRefreshTimers.get(variantId);
      if (timer) clearTimeout(timer);
      this.priceRefreshTimers.delete(variantId);
      this.priceRefreshSeq.set(variantId, (this.priceRefreshSeq.get(variantId) ?? 0) + 1);
    }

    const current = this.items();
    const source = current.find(item => item.variantId === fromVariantId);
    if (!source) return;

    const destination = current.find(item => item.variantId === toVariant.variantId);
    const config = this.pricingConfigService.pricingConfig();
    const quantity = destination ? destination.quantity + source.quantity : source.quantity;
    const pricingBase = destination ?? source;
    const updatedPricing = config && pricingBase.cost_usd_master && pricingBase.units_per_pack_master && toVariant.units_per_pack
      ? calculateLocalPrice(
          Number(pricingBase.cost_usd_master) || 0,
          Number(pricingBase.units_per_pack_master) || 1,
          Number(toVariant.units_per_pack) || 1,
          quantity,
          pricingBase.cost_currency,
          config
        )
      : { price_ars: pricingBase.price_ars, price_usd: pricingBase.price_usd, price_sin_impuestos_ars: pricingBase.price_sin_impuestos_ars };

    if (destination) {
      this.items.set(current
        .filter(item => item.variantId !== fromVariantId)
        .map(item => item.variantId === toVariant.variantId
          ? { ...item, quantity, ...updatedPricing }
          : item));
    } else {
      this.items.set(current.map(item => item.variantId === fromVariantId
        ? {
            ...item,
            variantId: toVariant.variantId,
            sku: toVariant.sku,
            stock: toVariant.stock,
            units_per_pack: toVariant.units_per_pack,
            cost_usd: toVariant.cost_usd ?? item.cost_usd,
            quantity,
            ...updatedPricing
          }
        : item));
    }

    this.saveToStorage();
  }

  clear(): void {
    this.items.set([]);
    this.saveToStorage();
  }

  private async recalculateAllPrices(): Promise<void> {
    const currentItems = this.items();
    if (currentItems.length === 0) return;

    const config = this.pricingConfigService.pricingConfig();
    const updates = currentItems.map(item => {
      if (!config || !item.cost_usd_master || !item.units_per_pack_master || !item.units_per_pack) {
        return item;
      }

      const pricing = calculateLocalPrice(
        Number(item.cost_usd_master) || 0,
        Number(item.units_per_pack_master) || 1,
        Number(item.units_per_pack) || 1,
        item.quantity,
        item.cost_currency,
        config
      );
      return { ...item, ...pricing };
    });

    this.items.set(updates);
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
            exchange_rate: settings.usd_exchange_rate
          });
        }
      }
    } catch (e) {
      console.error('Error al obtener configuracion del backend:', e);
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
        this.items.set(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Error al cargar carrito del storage:', e);
      this.items.set([]);
    }
  }
}
