import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PostalCodeLookup {
  postal_code: string;
  province: string;
  /** Provincias posibles del código; más de una solo en códigos compartidos. */
  provinces?: string[];
  locality: string;
  county: string | null;
  country: string;
}

export interface ShippingQuote {
  postal_code: string;
  zone: string | null;
  price_ars: number | null;
}

@Injectable({ providedIn: 'root' })
export class PostalCodeService {
  private readonly api = inject(ApiService);

  lookup(cp: string, province?: string): Observable<PostalCodeLookup> {
    const query = province ? `?province=${encodeURIComponent(province)}` : '';
    return this.api.get<PostalCodeLookup>(`/postal-code/${cp}${query}`);
  }

  quote(
    cp: string,
    items: Array<
      | { productId: string; units: number }
      | { product_id: string; units: number }
    >,
    province?: string,
  ): Observable<ShippingQuote> {
    const payloadItems = items.map((item) => ({
      product_id: 'productId' in item ? item.productId : item.product_id,
      units: item.units,
    }));
    return this.api.post<ShippingQuote>('/shipping/quote', {
      postal_code: cp,
      ...(province ? { province } : {}),
      items: payloadItems,
    });
  }
}
