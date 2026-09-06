import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductsService } from '../../../core/services/products.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { ProgressiveImageComponent } from '../../../shared/components/progressive-image/progressive-image.component';
import { logError } from '../../../shared/utils/log.util';

@Component({
  selector: 'app-productos-destacados',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SkeletonComponent,
    ProgressiveImageComponent,
  ],
  templateUrl: './productos-destacados.component.html',
  styleUrl: './productos-destacados.component.css',
})
export class ProductosDestacadosComponent implements OnInit {
  private readonly productsService = inject(ProductsService);

  productos = this.productsService.products;
  loading = this.productsService.loading;

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.productsService.getProducts().subscribe({
      error: (err: any) => {
        logError('Error al cargar productos destacados:', err);
      },
    });
  }
}
