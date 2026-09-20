import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ProductCategory } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly api = inject(ApiService);
  private categories$: Observable<ProductCategory[]> | null = null;

  getAll(): Observable<ProductCategory[]> {
    this.categories$ ??= this.api
      .get<ProductCategory[]>('/categories')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.categories$;
  }

  /** Cadena de categorías desde la raíz hasta `slug` (incluida). */
  pathTo(slug: string, all: ProductCategory[]): ProductCategory[] {
    const path: ProductCategory[] = [];
    let current = all.find((c) => c.slug === slug);
    while (current && !path.includes(current)) {
      path.unshift(current);
      const parentId: string | null = current.parent_id;
      current = parentId ? all.find((c) => c.id === parentId) : undefined;
    }
    return path;
  }
}
