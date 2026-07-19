import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ProductsService } from '../../core/services/products.service';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent, ProductCardSkeletonComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly productsService = inject(ProductsService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  products = this.productsService.products;
  loading = this.productsService.loading;
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
    this.error.set(null);
    this.titleService.setTitle('Catálogo de Macetas Biodegradables | Brotalia');
    this.metaService.updateTag({
      name: 'description',
      content: 'Catálogo completo de macetas biodegradables (turba, papel y cartón) mayoristas y minoristas: almacigueras, macetas florales y más. Envíos a todo el país.'
    });
    this.productsService.getProducts().subscribe({
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
      }
    });
  }
}



