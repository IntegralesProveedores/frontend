import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { PricingConfigService } from './pricing-config.service';
import { PricingConfig, Product } from '../models/product.model';
import { PaginatedResponse } from '../models/api-response.model';
import { estimateStockUnits } from '../lib/cart-stock';
import { logError } from '../../shared/utils/log.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Lo que el carrito necesita del backend: la cotización del dólar y el catálogo
//           (configuración de precios, stock por producto y qué presentaciones existen).
// POR QUÉ:  Antes vivía dentro de CartService junto con el estado y los precios. El
//           carrito decide qué hacer con los datos (recalcular, sacar lo borrado).
// ─────────────────────────────────────────────────────────────

/** Máximo que acepta GET /products por página. */
const CATALOG_PAGE_LIMIT = 50;

export type CatalogResponse = PaginatedResponse<Product> & { pricing_config?: PricingConfig };

@Injectable({ providedIn: 'root' })
export class CartCatalogService {
  private readonly apiService = inject(ApiService);
  private readonly pricingConfigService = inject(PricingConfigService);

  private readonly dolarVenta = signal<number>(0);
  readonly dolarOficial = this.dolarVenta.asReadonly();
  /** Unidades en stock de cada producto según el último catálogo pedido (el stock es por
   *  unidades del producto, no por presentación). */
  private readonly productStockUnits = signal<Map<string, number>>(new Map());

  stockUnitsOf(productId: string): number | undefined {
    return this.productStockUnits().get(productId);
  }

  /** Pide la cotización del dólar y la aplica a la configuración de precios. */
  async refreshExchangeRate(): Promise<void> {
    try {
      const settings = await firstValueFrom(this.apiService.getSettings());
      if (settings?.usd_exchange_rate) {
        this.dolarVenta.set(settings.usd_exchange_rate);
        const config = this.pricingConfigService.pricingConfig();
        if (config) {
          this.pricingConfigService.setPricingConfig({
            ...config,
            exchange_rate: settings.usd_exchange_rate,
          });
        }
      }
    } catch (e) {
      logError('Error al obtener configuracion del backend:', e);
    }
  }

  /**
   * Pide el catálogo sin caché (el parámetro _t evita los 60 s de /products) y actualiza el
   * stock por producto. Los errores de red los maneja quien llama.
   */
  async fetchCatalog(): Promise<CatalogResponse> {
    const response = await firstValueFrom(
      this.apiService.get<CatalogResponse>('/products', {
        limit: String(CATALOG_PAGE_LIMIT),
        _t: String(Date.now()),
      }),
    );
    const next = new Map(this.productStockUnits());
    for (const p of response.items ?? []) next.set(p.id, estimateStockUnits(p.variants ?? []));
    this.productStockUnits.set(next);
    return response;
  }
}

/**
 * IDs de las presentaciones que existen en el catálogo, o null si no se puede saber
 * (catálogo en más de una página: faltarían productos que sí existen).
 */
export function availableVariantIds(catalog: PaginatedResponse<Product>): Set<string> | null {
  if (catalog.pagination?.total_pages !== 1 || !Array.isArray(catalog.items)) return null;
  return new Set(catalog.items.flatMap((p) => (p.variants ?? []).map((v) => v.id)));
}
