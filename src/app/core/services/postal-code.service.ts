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
}

@Injectable({ providedIn: 'root' })
export class PostalCodeService {
  private readonly api = inject(ApiService);

  lookup(cp: string): Observable<PostalCodeLookup> {
    return this.api.get<PostalCodeLookup>(`/postal-code/${cp}`);
  }

  quote(cp: string): Observable<ShippingQuote> {
    return this.api.get<ShippingQuote>('/shipping/quote', { postal_code: cp });
  }
}
