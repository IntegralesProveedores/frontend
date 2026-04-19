import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent, LoadingSpinnerComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activeFilter = signal<string>('todos');

  categories = computed(() => {
    const all = this.products().flatMap(p => p.categories ?? []);
    const unique = new Map(all.map(c => [c.id, c]));
    return Array.from(unique.values());
  });

  filtered = computed(() => {
    const f = this.activeFilter();
    if (f === 'todos') return this.products();
    return this.products().filter(p =>
      p.categories?.some(c => c.slug === f)
    );
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<Product[]>('/products').subscribe({
      next: data => {
        this.products.set(data);
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

  trackById(_: number, p: Product): string {
    return p.id;
  }
}


