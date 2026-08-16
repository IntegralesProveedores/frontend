import { Injectable, signal, computed, PLATFORM_ID, inject, Injector } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, skip } from 'rxjs';
import { ShippingAddress, ShippingMethod, ShippingSelection } from '../models/order.model';
import { isCabaProvince, isBuenosAiresProvince } from '../../shared/utils/province.utils';
import { ShippingQuote, PostalCodeService } from './postal-code.service';
import { CartService } from './cart.service';

const SHIPPING_KEY = 'shipping_selection';
const EMPTY: ShippingSelection = { method: null, address: null };

type QuoteData = Pick<ShippingQuote, 'zone' | 'price_ars' | 'boxes'>;

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly selection = signal<ShippingSelection>(EMPTY);
  private readonly quoteSignal = signal<QuoteData | null>(null);
  private readonly quotingSignal = signal(false);
  private readonly quotedKey = signal<string | null>(null);
  private readonly injector = inject(Injector);
  private readonly postalCodeService = inject(PostalCodeService);
  private readonly productGroups = computed(() => {
    const cartService = this.injector.get(CartService);
    const groups = new Map<string, number>();
    for (const item of cartService.cartItems()) {
      groups.set(item.productId, (groups.get(item.productId) ?? 0) + item.quantity * (item.units_per_pack || 1));
    }
    return Array.from(groups, ([productId, units]) => ({ productId, units }));
  });
  private readonly productGroups$ = toObservable(this.productGroups);

  readonly current = this.selection.asReadonly();
  readonly quote = this.quoteSignal.asReadonly();
  readonly quoting = this.quotingSignal.asReadonly();

  readonly shippingCost = computed(() => {
    const method = this.selection().method;
    if (method === 'delivery') return this.quoteSignal()?.price_ars ?? null;
    if (method === 'pickup' || method === 'coordinar') return 0;
    return null;
  });

  readonly isValid = computed(() => {
    const s = this.selection();
    if (s.method === 'pickup' || s.method === 'coordinar') return true;
    if (s.method === 'delivery') {
      const a = s.address;
      if (!a?.postal_code || !a?.street || !a?.street_number || !a?.province) return false;
      if (isCabaProvince(a.province)) return true;
      if (isBuenosAiresProvince(a.province)) return !!(a.locality && a.county);
      return !!a.locality;
    }
    return false;
  });

  constructor() {
    if (this.isBrowser) {
      this.loadFromStorage();
      this.watchCartChanges();
    }
  }

  private watchCartChanges(): void {
    this.productGroups$.pipe(
      skip(1),
      debounceTime(300),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(groups => {
      const s = this.selection();
      const cp = s.address?.postal_code ?? '';
      if (s.method !== 'delivery' || !/^\d{4}$/.test(cp) || groups.length === 0) return;

      this.quotingSignal.set(true);
      this.postalCodeService.quote(cp, groups).pipe(
        finalize(() => this.quotingSignal.set(false))
      ).subscribe({
        next: quote => this.setQuote({ zone: quote.zone, price_ars: quote.price_ars, boxes: quote.boxes }, cp),
        error: () => this.setQuote(null)
      });
    });
  }

  setMethod(method: ShippingMethod): void {
    this.selection.update(s => ({ ...s, method, address: method === 'pickup' || method === 'coordinar' ? null : s.address }));
    if (method !== 'delivery') {
      this.quoteSignal.set(null);
      this.quotedKey.set(null);
    }
    this.saveToStorage();
  }

  setAddress(address: ShippingAddress): void {
    this.selection.update(s => ({ ...s, address }));
    this.saveToStorage();
  }

  setQuote(quote: QuoteData | null, cp?: string): void {
    this.quoteSignal.set(quote);
    this.quotedKey.set(quote && cp ? this.quoteKeyFor(cp) : null);
  }

  private quoteKeyFor(cp: string): string {
    const groups = [...this.productGroups()].sort((a, b) => a.productId.localeCompare(b.productId));
    return `${cp}|${groups.map(g => `${g.productId}:${g.units}`).join(',')}`;
  }

  hasValidQuote(cp: string): boolean {
    return this.quoteSignal() !== null && this.quotedKey() === this.quoteKeyFor(cp);
  }

  clear(): void {
    this.selection.set(EMPTY);
    this.quoteSignal.set(null);
    this.quotedKey.set(null);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (this.isBrowser) localStorage.setItem(SHIPPING_KEY, JSON.stringify(this.selection()));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SHIPPING_KEY);
      if (raw) this.selection.set(JSON.parse(raw));
    } catch {
      this.selection.set(EMPTY);
    }
  }
}
