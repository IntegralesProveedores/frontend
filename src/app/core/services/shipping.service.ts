import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { ShippingAddress, ShippingMethod, ShippingSelection } from '../models/order.model';
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
  private readonly cartService = inject(CartService);
  private readonly postalCodeService = inject(PostalCodeService);
  private readonly totalUnits = computed(() =>
    Math.round(1000 * this.cartService.cartItems().reduce(
      (sum, i) => sum + (i.quantity * (i.units_per_pack || 1)) / (i.units_per_pack_master || 1),
      0
    ))
  );
  private readonly totalUnits$ = toObservable(this.totalUnits);

  readonly current = this.selection.asReadonly();
  readonly quote = this.quoteSignal.asReadonly();

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
      return !!(a?.postal_code && a?.street && a?.street_number && a?.province && a?.locality);
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
    this.totalUnits$.pipe(
      skip(1),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(units => {
      const s = this.selection();
      const cp = s.address?.postal_code ?? '';
      if (s.method !== 'delivery' || !/^\d{4}$/.test(cp) || units <= 0) return;

      this.postalCodeService.quote(cp, units).subscribe({
        next: quote => this.setQuote({ zone: quote.zone, price_ars: quote.price_ars, boxes: quote.boxes }),
        error: () => this.setQuote(null)
      });
    });
  }

  setMethod(method: ShippingMethod): void {
    this.selection.update(s => ({ ...s, method, address: method === 'pickup' || method === 'coordinar' ? null : s.address }));
    if (method !== 'delivery') this.quoteSignal.set(null);
    this.saveToStorage();
  }

  setAddress(address: ShippingAddress): void {
    this.selection.update(s => ({ ...s, address }));
    this.saveToStorage();
  }

  setQuote(quote: QuoteData | null): void {
    this.quoteSignal.set(quote);
  }

  clear(): void {
    this.selection.set(EMPTY);
    this.quoteSignal.set(null);
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
