import { Injectable, signal, computed, PLATFORM_ID, inject, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { PricingConfigService } from './pricing-config.service';
import { calculateLocalPrice } from '../lib/pricing.util';

const CART_KEY = 'cart_items';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiService = inject(ApiService);
  private readonly pricingConfigService = inject(PricingConfigService);

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
          config
        )
      : { price_ars: item.price_ars, price_usd: item.price_usd };

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
        config
      );

      this.items.set(this.items().map(i =>
        i.variantId === variantId ? { ...i, ...updatedPricing, quantity } : i
      ));
      this.saveToStorage();
    }, 350);

    this.priceRefreshTimers.set(variantId, timer);
  }

  clear(): void {
    this.items.set([]);
    this.saveToStorage();
  }

  getVariantQuantity(variantId: string | undefined): number {
    if (!variantId) return 0;
    const item = this.items().find(i => i.variantId === variantId);
    return item ? item.quantity : 0;
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
