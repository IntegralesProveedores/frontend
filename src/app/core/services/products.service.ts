import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Product } from '../models/product.model';
import { PaginatedResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly api = inject(ApiService);

  private readonly productsSignal = signal<Product[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private loaded = false;
  private request$: Observable<Product[]> | null = null;

  readonly products = this.productsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  getProducts(): Observable<Product[]> {
    if (this.loaded) {
      return of(this.productsSignal());
    }

    if (this.request$) {
      return this.request$;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.request$ = this.api.get<PaginatedResponse<Product>>('/products').pipe(
      map((response) => response.items),
      tap((products) => {
        this.productsSignal.set(products);
        this.loaded = true;
        this.loadingSignal.set(false);
      }),
      catchError((error) => {
        this.errorSignal.set('No se pudieron cargar los productos.');
        this.loadingSignal.set(false);
        return throwError(() => error);
      }),
      finalize(() => {
        this.request$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.request$;
  }
}
