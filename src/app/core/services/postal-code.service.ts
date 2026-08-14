import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PostalCodeLookup {
  postal_code: string;
  province: string;
  locality: string;
  county: string | null;
  country: string;
}

export interface ShippingQuote {
  postal_code: string;
  zone: string | null;
  price_ars: number | null;
  boxes?: {
    boxModelName: string;
    widthCm: number;
    lengthCm: number;
    heightCm: number;
    weightKg: number;
    count: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class PostalCodeService {
  private readonly api = inject(ApiService);

  lookup(cp: string): Observable<PostalCodeLookup> {
    return this.api.get<PostalCodeLookup>(`/postal-code/${cp}`);
  }

  quote(cp: string, items: Array<{ productId: string; units: number } | { product_id: string; units: number }>): Observable<ShippingQuote> {
    const payloadItems = items.map(item => ({
      product_id: 'productId' in item ? item.productId : item.product_id,
      units: item.units
    }));
    return this.api.post<ShippingQuote>('/shipping/quote', { postal_code: cp, items: payloadItems });
  }
}
