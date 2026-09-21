import {
  Injectable,
  signal,
  computed,
  PLATFORM_ID,
  inject,
  Injector,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  debounceTime,
  distinctUntilChanged,
  finalize,
  shareReplay,
  skip,
} from 'rxjs';
import {
  ShippingAddress,
  ShippingMethod,
  ShippingSelection,
} from '../models/order.model';
import {
  isCabaProvince,
  isBuenosAiresProvince,
} from '../../shared/utils/province.utils';
import { ShippingQuote, PostalCodeService } from './postal-code.service';
import { CartService } from './cart.service';

const SHIPPING_KEY = 'shipping_selection';
const EMPTY: ShippingSelection = { method: null, address: null };
const VALID_METHODS = ['pickup', 'delivery', 'coordinar'];

function isShippingSelection(value: unknown): value is ShippingSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v['method'] === null || VALID_METHODS.includes(v['method'] as string);
}

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
  /** Cotizaciones en curso por clave: dos pedidos idénticos simultáneos comparten una sola consulta. */
  private readonly inflightQuotes = new Map<string, Observable<ShippingQuote>>();
  private readonly productGroups = computed(() => {
    const cartService = this.injector.get(CartService);
    const groups = new Map<string, number>();
    for (const item of cartService.cartItems()) {
      groups.set(
        item.productId,
        (groups.get(item.productId) ?? 0) +
          item.quantity * (item.units_per_pack || 1),
      );
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
      if (!a?.postal_code || !a?.street || !a?.street_number || !a?.province)
        return false;
      const addressComplete = isCabaProvince(a.province)
        ? true
        : isBuenosAiresProvince(a.province)
          ? !!(a.locality && a.county)
          : !!a.locality;
      // Sin cotización vigente el carrito suma envío 0 pero el backend cobra el
      // envío real: no se puede pagar hasta tener el precio.
      return (
        addressComplete &&
        this.hasValidQuote(a.postal_code) &&
        this.quoteSignal()?.price_ars != null
      );
    }
    return false;
  });

  /** Envío a domicilio sin precio cotizado para el carrito y la dirección actuales. */
  readonly quoteMissing = computed(() => {
    const s = this.selection();
    const cp = s.address?.postal_code ?? '';
    return (
      s.method === 'delivery' &&
      /^\d{4}$/.test(cp) &&
      !(this.hasValidQuote(cp) && this.quoteSignal()?.price_ars != null)
    );
  });

  constructor() {
    if (this.isBrowser) {
      this.loadFromStorage();
      this.watchCartChanges();
    }
  }

  private watchCartChanges(): void {
    this.productGroups$
      .pipe(
        skip(1),
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      )
      .subscribe((groups) => {
        const s = this.selection();
        const cp = s.address?.postal_code ?? '';
        if (
          s.method !== 'delivery' ||
          !/^\d{4}$/.test(cp) ||
          groups.length === 0
        )
          return;
        // Ya hay una cotización para este CP, provincia y carrito (ej. la que
        // pidió el selector al abrir la página): no repetirla.
        if (this.hasValidQuote(cp)) return;

        this.fetchAndStoreQuote(cp, groups, s.address?.province || undefined);
      });
  }

  private fetchAndStoreQuote(
    cp: string,
    groups: Array<{ productId: string; units: number }>,
    province?: string,
  ): void {
    this.quotingSignal.set(true);
    this.requestQuote(cp, groups, province)
      .pipe(finalize(() => this.quotingSignal.set(false)))
      .subscribe({
        next: (quote) =>
          this.setQuote(
            {
              zone: quote.zone,
              price_ars: quote.price_ars,
              boxes: quote.boxes,
            },
            cp,
          ),
        error: () => this.setQuote(null),
      });
  }

  /** Vuelve a cotizar el envío con los datos actuales (ej. cuando el backend avisa que los precios cambiaron). */
  refreshQuote(): void {
    const s = this.selection();
    const cp = s.address?.postal_code ?? '';
    const groups = this.productGroups();
    if (s.method !== 'delivery' || !/^d{4}$/.test(cp) || groups.length === 0)
      return;
    this.fetchAndStoreQuote(cp, groups, s.address?.province || undefined);
  }

  /**
   * Pide la cotización al backend. Si ya hay una idéntica en curso (mismo CP,
   * provincia y carrito), se comparte en vez de repetir la consulta.
   */
  requestQuote(
    cp: string,
    groups: Array<{ productId: string; units: number }>,
    province?: string,
  ): Observable<ShippingQuote> {
    const key = `${cp}|${province ?? ''}|${[...groups]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map((g) => `${g.productId}:${g.units}`)
      .join(',')}`;
    let request = this.inflightQuotes.get(key);
    if (!request) {
      request = this.postalCodeService.quote(cp, groups, province).pipe(
        finalize(() => this.inflightQuotes.delete(key)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.inflightQuotes.set(key, request);
    }
    return request;
  }

  setMethod(method: ShippingMethod): void {
    // La cotización se conserva al pasar a Retiro/Coordinar (el costo sale del
    // método, no de la cotización): al volver se reutiliza si la clave sigue
    // vigente (mismo CP, provincia y carrito) y se recotiza si no.
    this.selection.update((s) => ({ ...s, method }));
    this.saveToStorage();
  }

  setAddress(address: ShippingAddress): void {
    this.selection.update((s) => ({ ...s, address }));
    this.saveToStorage();
  }

  setQuote(quote: QuoteData | null, cp?: string): void {
    this.quoteSignal.set(quote);
    this.quotedKey.set(quote && cp ? this.quoteKeyFor(cp) : null);
  }

  private quoteKeyFor(cp: string): string {
    const province = this.selection().address?.province ?? '';
    const groups = [...this.productGroups()].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    );
    return `${cp}|${province}|${groups.map((g) => `${g.productId}:${g.units}`).join(',')}`;
  }

  hasValidQuote(cp: string): boolean {
    return (
      this.quoteSignal() !== null && this.quotedKey() === this.quoteKeyFor(cp)
    );
  }

  clear(): void {
    this.selection.set(EMPTY);
    this.quoteSignal.set(null);
    this.quotedKey.set(null);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (this.isBrowser)
      localStorage.setItem(SHIPPING_KEY, JSON.stringify(this.selection()));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SHIPPING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.selection.set(isShippingSelection(parsed) ? parsed : EMPTY);
      }
    } catch {
      this.selection.set(EMPTY);
    }
  }
}
