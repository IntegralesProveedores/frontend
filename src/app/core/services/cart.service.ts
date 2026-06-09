import { Injectable, signal, computed, PLATFORM_ID, inject, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { Product } from '../models/product.model';

const CART_KEY = 'cart_items';

@Injectable({ providedIn: 'root' })
export class CartService {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiService = inject(ApiService);
  
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

  async add(item: CartItem): Promise<void> {
    const current = this.items();
    const existing = current.find(i => i.variantId === item.variantId);
    const newQuantity = existing ? existing.quantity + item.quantity : item.quantity;

    // Obtener precio actualizado del backend para la cantidad total
    const updatedPricing = await this.fetchPriceFromBackend(item.slug, item.variantId, newQuantity);

    if (existing) {
      this.items.set(current.map(i => 
        i.variantId === item.variantId ? { ...i, ...updatedPricing, quantity: newQuantity } : i
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

    const updatedPricing = await this.fetchPriceFromBackend(item.slug, variantId, quantity);

    this.items.set(this.items().map(i => {
      if (i.variantId === variantId) {
        return { ...i, ...updatedPricing, quantity };
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
   * Consulta al backend el precio actualizado de una variante según la cantidad.
   */
  private async fetchPriceFromBackend(slug: string, variantId: string, quantity: number) {
    try {
      const product = await firstValueFrom(
        this.apiService.get<Product>(`/products/${slug}`, { quantity: quantity.toString() })
      );
      const variant = product.variants?.find(v => v.id === variantId);
      
      if (!variant) throw new Error('Variant not found in backend response');

      return {
        price_ars: variant.price_ars,
        price_usd: variant.price_usd
      };
    } catch (e) {
      console.error('Error al obtener precio del backend:', e);
      // En caso de error, devolvemos los valores actuales como fallback
      const current = this.items().find(i => i.variantId === variantId);
      return {
        price_ars: current?.price_ars || 0,
        price_usd: current?.price_usd || 0
      };
    }
  }

  /**
   * Recalcula todos los precios en el carrito cuando cambia la cotización.
   */
  private async recalculateAllPrices(): Promise<void> {
    const currentItems = this.items();
    if (currentItems.length === 0) return;

    const updates = await Promise.all(
      currentItems.map(async item => {
        const pricing = await this.fetchPriceFromBackend(item.slug, item.variantId, item.quantity);
        return { ...item, ...pricing };
      })
    );

    this.items.set(updates);
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

