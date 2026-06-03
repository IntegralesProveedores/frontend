import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Product } from '../../../core/models/product.model';
import { PaginatedResponse } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-productos-preview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './productos-preview.component.html',
  styleUrl: './productos-preview.component.css'
})
export class ProductosPreviewComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly api = inject(ApiService);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  productos = signal<Product[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadProducts();
  }

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  loadProducts(): void {
    this.loading.set(true);
    this.api.get<PaginatedResponse<Product>>('/products').subscribe({
      next: (data) => {
        this.productos.set(data.items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos preview:', err);
        this.loading.set(false);
      }
    });
  }

  /**
   * Obtiene medidas formateadas del producto (usando la primera variante).
   * CUIDADO: Esta es una simplificación visual para la home.
   */
  getMeasurements(p: Product): string {
    const v = p.variants?.[0];
    if (!v || !v.dimensions) return '';
    const d = v.dimensions;
    if (d.diameter_cm) return `${d.diameter_cm} cm (d) x ${d.height_cm} cm (h)`;
    if (d.length_cm) return `${d.length_cm}x${d.width_cm}x${d.height_cm} cm (h)`;
    return '';
  }
}

