import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-productos-preview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './productos-preview.component.html',
  styleUrl: './productos-preview.component.css'
})
export class ProductosPreviewComponent implements OnInit {
  productos = signal<Product[]>([]);
  loading = signal(true);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.api.get<Product[]>('/products').subscribe({
      next: (data) => {
        this.productos.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos preview:', err);
        this.loading.set(false);
      }
    });
  }

  // Helper para obtener medidas de forma segura
  getMeasurements(p: Product): string {
    const v = p.variants?.[0];
    if (!v || !v.dimensions) return '';
    const d = v.dimensions;
    if (d.diameter_cm) return `${d.diameter_cm} cm (d) x ${d.height_cm} cm (h)`;
    if (d.length_cm) return `${d.length_cm}x${d.width_cm}x${d.height_cm} cm (h)`;
    return '';
  }
}


