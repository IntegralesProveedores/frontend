import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { Product } from '../../../../core/models/product.model';
import { PaginatedResponse } from '../../../../core/models/api-response.model';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { ProgressiveImageComponent } from '../../../../shared/components/progressive-image/progressive-image.component';

@Component({
  selector: 'app-productos-destacados',
  standalone: true,
  imports: [CommonModule, RouterModule, SkeletonComponent, ProgressiveImageComponent],
  templateUrl: './productos-destacados.component.html',
  styleUrl: './productos-destacados.component.css'
})
export class ProductosDestacadosComponent implements OnInit {
  private readonly api = inject(ApiService);

  productos = signal<Product[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.api.get<PaginatedResponse<Product>>('/products').subscribe({
      next: (data: PaginatedResponse<Product>) => {
        this.productos.set(data.items);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error al cargar productos destacados:', err);
        this.loading.set(false);
      }
    });
  }
}
