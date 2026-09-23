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
import { catchError, debounceTime, distinctUntilChanged, map, retry, switchMap } from 'rxjs/operators';
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

const MAX_RETRY_MS = 15000;
const RATE_LIMITED_RETRY_MS = 30000;

/** 4xx salvo 408/429: el pedido en sí es inválido, reintentar no lo arregla. */
function isPermanentError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status ?? 0;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

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
        // groups es un array nuevo cada vez que el carrito se reescribe (p. ej. al repartir el
        // embalaje en los precios): sin esto, cada cotización dispara otra y se arma un bucle.
        distinctUntilChanged(
          (a, b) => a.length === b.length && a.every((g, i) => g.productId === b[i].productId && g.units === b[i].units),
        ),
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
              // Una falla (red, backend caído, límite de pedidos) suele ser pasajera: se
              // reintenta sin límite de veces y sin mostrarle nada al cliente, así el botón
              // de pagar nunca queda trabado en "Procesando". Un 429 espera 30 s (el límite
              // es de 30 pedidos por minuto): insistir antes solo suma pedidos al mismo
              // límite. switchMap corta los reintentos si el carrito cambia.
              retry({
                delay: (error, retryCount) => {
                  if (isPermanentError(error)) return throwError(() => error);
                  return timer(
                    error?.status === 429
                      ? RATE_LIMITED_RETRY_MS
                      : Math.min(1000 * 2 ** retryCount, MAX_RETRY_MS),
                  );
                },
              }),
              map((quote) => ({ quote, requestKey })),
              catchError((error) => {
                // Error del pedido en sí (ej. un producto del carrito que ya no existe):
                // reintentar no lo arregla. ready() sigue en false hasta que el carrito cambie.
                logError('No se pudo cotizar el embalaje:', error);
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
