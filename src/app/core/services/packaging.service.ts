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
import { EMPTY, of, throwError, timer } from 'rxjs';
import { catchError, debounceTime, map, retry, switchMap } from 'rxjs/operators';
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
  /** Embalaje por producto: el de cada producto son sus propias cajas, nunca compartidas
   *  con otro producto. El carrito lo usa para sumarlo al precio de cada línea. La API
   *  también manda un total agregado (embalaje_ars/embalaje_box_price_ars) que acá no
   *  hace falta: el precio ya queda repartido dentro de cada producto. */
  by_product: { product_id: string; embalaje_ars: number }[];
}

@Injectable({ providedIn: 'root' })
export class PackagingService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly quote = signal<PackagingQuote | null>(null);
  private readonly quotedKey = signal<string | null>(null);

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
  /** product_id -> embalaje de ese producto (sus propias cajas). Lo usa CartService para
   *  sumarlo al precio de cada línea (ver embalajePerPackArs en pricing.util.ts). */
  readonly embalajeByProduct = computed(
    () =>
      new Map(
        (this.quote()?.by_product ?? []).map((p) => [
          p.product_id,
          p.embalaje_ars,
        ]),
      ),
  );

  /** true cuando la cotización corresponde al carrito actual (o el carrito está vacío). */
  readonly ready = computed(
    () => this.groups().length === 0 || this.quotedKey() === this.key(),
  );

  constructor() {
    if (!this.isBrowser) return;
    toObservable(this.groups)
      .pipe(
        debounceTime(250),
        switchMap((groups) => {
          if (groups.length === 0) {
            this.quote.set(null);
            this.quotedKey.set(null);
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
              // Una falla (red, límite de pedidos, etc.) suele ser pasajera: se reintenta
              // solo, sin mostrarle nada al cliente ni bloquear el botón de pagar más de
              // lo necesario. Un 429 (límite de pedidos) NO se reintenta: insistir no
              // ayuda a que se libere antes, solo suma pedidos al mismo límite.
              retry({
                count: 5,
                delay: (error, retryCount) =>
                  error?.status === 429
                    ? throwError(() => error)
                    : timer(Math.min(1000 * 2 ** retryCount, 8000)),
              }),
              map((quote) => ({ quote, requestKey })),
              catchError((error) => {
                // El carrito queda sin cotización vigente: ready() sigue en false y el
                // botón de pagar espera (sin mostrar nada) a que el carrito cambie o a
                // que una consulta futura tenga éxito.
                logError(
                  'No se pudo cotizar el embalaje tras varios intentos:',
                  error,
                );
                return of(null);
              }),
            );
        }),
      )
      .subscribe((result) => {
        if (!result) return;
        this.quote.set(result.quote);
        this.quotedKey.set(result.requestKey);
      });
  }
}
