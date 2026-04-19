import { Injectable, signal, computed, Inject, PLATFORM_ID, inject, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem } from '../models/cart.model';
import { ApiService } from './api.service';
import { PriceService } from './price.service';

const CART_KEY = 'cart_items';

@Injectable({ providedIn: 'root' })
export class CartService {
  private isBrowser: boolean;
  private apiService = inject(ApiService);
  private priceService = inject(PriceService);
  
  // Signals para el estado del carrito y cotización
  private items = signal<CartItem[]>([]);
  private dolarVenta = signal<number>(0);

  // Readonly para consumo externo
  readonly cartItems = this.items.asReadonly();
  readonly dolarOficial = this.dolarVenta.asReadonly();

  // Computed: Cálculos dinámicos reactivos
  readonly itemCount = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly isEmpty = computed(() => this.items().length === 0);

  // Cálculo de totales en USD
  readonly totalUsd = computed(() => {
    return this.items().reduce((sum, i) => sum + (i.price_usd || 0) * i.quantity, 0);
  });

  // Cálculo de totales en ARS
  readonly subtotalArs = computed(() => {
    return this.items().reduce((sum, i) => sum + (i.price_ars || 0) * i.quantity, 0);
  });

  // Cálculo de volumen total en CC
  readonly totalVolumeCc = computed(() =>
    this.items().reduce((sum, i) => 
      sum + ((i.volume_cc || 0) * (i.units_per_pack || 1) * i.quantity), 0
    )
  );

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    if (this.isBrowser) {
      this.loadFromStorage();
      this.obtenerDolarOficial();
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

  // Métodos de acción
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
   * Obtiene la cantidad de una variante específica que ya está en el carrito
   */
  getVariantQuantity(variantId: string | undefined): number {
    if (!variantId) return 0;
    const item = this.items().find(i => i.variantId === variantId);
    return item ? item.quantity : 0;
  }

  private applyPricing(item: CartItem): CartItem {
    const pricing = this.priceService.calculatePrice(item.cost_usd, item.quantity, this.dolarVenta());
    return {
      ...item,
      price_ars: pricing.finalPriceArs,
      price_usd: pricing.finalPriceUsd
    };
  }

  private recalculateAllPrices(): void {
    const currentItems = this.items();
    if (currentItems.length === 0) return;

    const updatedItems = currentItems.map(item => this.applyPricing(item));
    this.items.set(updatedItems);
  }

  // Integración con DolarAPI (tal cual estaba)
  private async obtenerDolarOficial() {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
      const data = await res.json();
      if (data?.venta) {
        this.dolarVenta.set(data.venta);
      }
    } catch (e) {
      console.error('Error al obtener el dólar oficial de DolarAPI:', e);
    }
  }

  // Persistencia
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


