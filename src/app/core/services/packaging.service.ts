import {
  Injectable,
  Injector,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CartService } from './cart.service';
import { logError } from '../../shared/utils/log.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Cotiza el embalaje del carrito: cuántas cajas de cada modelo de maceta hacen
//           falta y cuánto cuestan (POST /packaging/quote).
// POR QUÉ:  El embalaje se cobra por caja, no por pack, y con cualquier método de entrega
//           (también Retiro y Coordinar). Las cajas salen de las unidades totales por modelo.
// CUIDADO:  Cada cotización se guarda con la clave del carrito con el que se pidió, y switchMap
//           cancela la anterior: una respuesta vieja nunca queda como vigente.
// ─────────────────────────────────────────────────────────────

export interface PackagingBox {
  boxModelId: string;
  boxModelName: string;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  weightKg: number;
  count: number;
}

interface PackagingQuote {
  boxes: PackagingBox[];
  embalaje_box_price_ars: number;
  embalaje_ars: number;
}

@Injectable({ providedIn: 'root' })
export class PackagingService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly quote = signal<PackagingQuote | null>(null);
  private readonly quotedKey = signal<string | null>(null);
  private readonly failed = signal(false);

  private readonly groups = computed(() => {
    const cartService = this.injector.get(CartService);
    const units = new Map<string, number>();
    for (const item of cartService.cartItems()) {
      units.set(
        item.productId,
        (units.get(item.productId) ?? 0) +
          item.quantity * (item.units_per_pack || 1),
      );
    }
    return Array.from(units, ([productId, total]) => ({
      productId,
      units: total,
    })).sort((a, b) => a.productId.localeCompare(b.productId));
  });

  private readonly key = computed(() =>
    this.groups()
      .map((g) => `${g.productId}:${g.units}`)
      .join(','),
  );

  /** Cajas del carrito (las últimas cotizadas, para no parpadear mientras se recalcula). */
  readonly boxes = computed(() => this.quote()?.boxes ?? []);
  readonly embalajeArs = computed(() => this.quote()?.embalaje_ars ?? 0);

  /** true cuando la cotización corresponde al carrito actual (o el carrito está vacío). */
  readonly ready = computed(
    () => this.groups().length === 0 || this.quotedKey() === this.key(),
  );
  /** Falló la cotización del carrito actual: no se puede pagar. */
  readonly error = computed(() => this.failed() && !this.ready());

  constructor() {
    if (!this.isBrowser) return;
    toObservable(this.groups)
      .pipe(
        debounceTime(250),
        switchMap((groups) => {
          if (groups.length === 0) {
            this.quote.set(null);
            this.quotedKey.set(null);
            this.failed.set(false);
            return EMPTY;
          }
          const requestKey = groups
            .map((g) => `${g.productId}:${g.units}`)
            .join(',');
          return this.api
            .post<PackagingQuote>('/packaging/quote', {
              items: groups.map((g) => ({
                product_id: g.productId,
                units: g.units,
              })),
            })
            .pipe(
              map((quote) => ({ quote, requestKey })),
              catchError((error) => {
                logError('No se pudo cotizar el embalaje:', error);
                this.failed.set(true);
                return of(null);
              }),
            );
        }),
      )
      .subscribe((result) => {
        if (!result) return;
        this.failed.set(false);
        this.quote.set(result.quote);
        this.quotedKey.set(result.requestKey);
      });
  }
}
