import { Injectable, signal, computed, PLATFORM_ID, inject, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { PriceService } from './price.service';

const CART_KEY = 'cart_items';

@Injectable({ providedIn: 'root' })
export class CartService {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiService = inject(ApiService);
  private readonly priceService = inject(PriceService);
  
  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  private readonly items = signal<CartItem[]>([]);
  private readonly dolarVenta = signal<number>(0);

  // Readonly para consumo externo
  readonly cartItems = this.items.asReadonly();
  readonly dolarOficial = this.dolarVenta.asReadonly();

  // ─────────────────────────────────────────────────────────────
  // DERIVACIONES (Computed)
  // ─────────────────────────────────────────────────────────────
  readonly itemCount = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly isEmpty = computed(() => this.items().length === 0);

  /** Total en USD sumando todos los items */
  readonly totalUsd = computed(() => {
    return this.items().reduce((sum, i) => sum + (i.price_usd || 0) * i.quantity, 0);
  });

  /** Subtotal en ARS basado en el tipo de cambio oficial */
  readonly subtotalArs = computed(() => {
    return this.items().reduce((sum, i) => sum + (i.price_ars || 0) * i.quantity, 0);
  });

  /** Volumen total en CC para cotización de envíos */
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

    // Efecto para recalcular precios cuando cambia el dólar
    effect(() => {
      const rate = this.dolarVenta();
      if (rate > 0) {
        untracked(() => {
          this.recalculateAllPrices();
        });
      }
    }, { allowSignalWrites: true });
  }

  // ─────────────────────────────────────────────────────────────
  // MÉTODOS PÚBLICOS
  // ─────────────────────────────────────────────────────────────

  add(item: CartItem): void {
    const current = this.items();
    const existing = current.find(i => i.variantId === item.variantId);

    if (existing) {
      this.updateQuantity(existing.variantId, existing.quantity + item.quantity);
    } else {
      const newItem = this.applyPricing(item);
      this.items.set([...current, newItem]);
      this.saveToStorage();
    }
  }

  remove(variantId: string): void {
    this.items.set(this.items().filter(i => i.variantId !== variantId));
    this.saveToStorage();
  }

  updateQuantity(variantId: string, quantity: number): void {
    if (quantity <= 0) {
      this.remove(variantId);
      return;
    }
    
    this.items.set(this.items().map(i => {
      if (i.variantId === variantId) {
        return this.applyPricing({ ...i, quantity });
      }
      return i;
    }));
    this.saveToStorage();
  }

  clear(): void {
    this.items.set([]);
    this.saveToStorage();
  }

  /**
   * Obtiene la cantidad de una variante específica en el carrito.
   * Útil para mostrar feedback en botones de "Agregar".
   */
  getVariantQuantity(variantId: string | undefined): number {
    if (!variantId) return 0;
    const item = this.items().find(i => i.variantId === variantId);
    return item ? item.quantity : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // LÓGICA INTERNA
  // ─────────────────────────────────────────────────────────────

  /** 
   * Aplica la lógica de precios actual (markup + cotización) a un item.
   */
  private applyPricing(item: CartItem): CartItem {
    const pricing = this.priceService.calculatePrice(item.cost_usd, item.quantity, this.dolarVenta());
    return {
      ...item,
      price_ars: pricing.finalPriceArs,
      price_usd: pricing.finalPriceUsd
    };
  }

  /**
   * Recalcula todos los precios en el carrito cuando cambia la cotización.
   */
  private recalculateAllPrices(): void {
    const currentItems = this.items();
    if (currentItems.length === 0) return;

    const updatedItems = currentItems.map(item => this.applyPricing(item));
    this.items.set(updatedItems);
  }

  /**
   * Obtiene el tipo de cambio oficial desde el backend (/settings).
   * CUIDADO: F1 - No llamar directamente a APIs externas desde el frontend.
   */
  private async refreshExchangeRate() {
    try {
      const settings = await firstValueFrom(this.apiService.getSettings());
      if (settings?.usd_exchange_rate) {
        this.dolarVenta.set(settings.usd_exchange_rate);
      }
    } catch (e) {
      console.error('Error al obtener configuración del backend:', e);
      // Fallback o reintento podría ir aquí
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PERSISTENCIA
  // ─────────────────────────────────────────────────────────────

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

