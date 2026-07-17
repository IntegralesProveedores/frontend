import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { PaginatedResponse } from '../../core/models/api-response.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent, ProductCardSkeletonComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly api = inject(ApiService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

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
    this.titleService.setTitle('Catálogo de Macetas Biodegradables | Brotalia');
    this.metaService.updateTag({
      name: 'description',
      content: 'Explorá nuestro catálogo completo de macetas biodegradables mayoristas y minoristas. Envíos a todo el país.'
    });
    this.api.get<PaginatedResponse<Product>>('/products').subscribe({
      next: data => {
        this.products.set(data.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      }
    });
  }
}



