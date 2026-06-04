import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { PaginatedResponse } from '../../core/models/api-response.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent, ProductCardSkeletonComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly api = inject(ApiService);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  products = signal<Product[]>([]);
  pagination = signal<PaginatedResponse<Product>['pagination'] | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  activeFilter = signal<string>('todos');

  // ─────────────────────────────────────────────────────────────
  // DERIVACIONES (Computed)
  // ─────────────────────────────────────────────────────────────
  
  /** Extrae categorías únicas de los productos cargados para los filtros */
  categories = computed(() => {
    const all = this.products().flatMap(p => p.categories);
    const unique = new Map(all.map(c => [c.id, c]));
    return Array.from(unique.values());
  });

  /** Filtra los productos en memoria según la categoría activa */
  filtered = computed(() => {
    const f = this.activeFilter();
    if (f === 'todos') return this.products();
    return this.products().filter(p =>
      p.categories?.some(c => c.slug === f)
    );
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  /** 
   * Carga la lista inicial de productos.
   * TODO [F4]: Implementar paginación real en backend y frontend.
   */
  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<PaginatedResponse<Product>>('/products').subscribe({
      next: data => {
        this.products.set(data.items);
        this.pagination.set(data.pagination);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      }
    });
  }

  setFilter(slug: string): void {
    this.activeFilter.set(slug);
  }
}



