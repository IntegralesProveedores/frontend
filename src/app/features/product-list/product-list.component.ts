import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ProductsService } from '../../core/services/products.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Product, ProductCategory } from '../../core/models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BreadcrumbComponent,
    ProductCardComponent,
    ProductCardSkeletonComponent,
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // ─────────────────────────────────────────────────────────────
  // ESTADO (Signals)
  // ─────────────────────────────────────────────────────────────
  private readonly categorySlug = signal<string | null>(null);
  private readonly categoryProducts = signal<Product[]>([]);
  private readonly categoryLoading = signal(true);

  category = signal<ProductCategory | null>(null);
  error = signal<string | null>(null);

  products = computed(() =>
    this.categorySlug()
      ? this.categoryProducts()
      : this.productsService.products(),
  );
  loading = computed(() =>
    this.categorySlug()
      ? this.categoryLoading()
      : this.productsService.loading(),
  );

  private readonly allCategories = signal<ProductCategory[]>([]);

  // En /productos se muestra la categoría que comparten todos los productos
  // listados; si hay varias distintas no hay una ruta única que mostrar.
  private readonly scopeSlug = computed<string | null>(() => {
    const slug = this.categorySlug();
    if (slug) return slug;
    const slugs = new Set(this.products().map((p) => p.category?.slug));
    const [only] = slugs;
    return slugs.size === 1 && only ? only : null;
  });

  breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: 'Productos', link: '/productos' },
    ];
    const slug = this.scopeSlug();
    if (!slug) return items;

    let path = this.categoriesService.pathTo(slug, this.allCategories());
    const category = this.category();
    if (!path.length && category) {
      path = category.parent ? [category.parent, category] : [category];
    }
    path.forEach((c, i) =>
      items.push(
        i < path.length - 1
          ? { label: c.name, link: `/categorias/${c.slug}` }
          : { label: c.name },
      ),
    );
    return items;
  });

  ngOnInit(): void {
    this.categoriesService.getAll().subscribe({
      next: (list) => this.allCategories.set(list),
      error: () => undefined,
    });

    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      this.categorySlug.set(slug);
      if (slug) {
        this.loadCategoryProducts(slug);
      } else {
        this.category.set(null);
        this.loadProducts();
      }
    });
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
      content:
        'Catálogo completo de macetas biodegradables (turba, papel y cartón) mayoristas y minoristas: almacigueras, macetas florales y más. Envíos a todo el país.',
    });
    this.productsService.getProducts().subscribe({
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
      },
    });
  }

  private loadCategoryProducts(slug: string): void {
    this.error.set(null);
    this.category.set(null);
    this.categoryProducts.set([]);
    this.categoryLoading.set(true);

    this.productsService.getCategoryProducts(slug).subscribe({
      next: ({ category, items }) => {
        this.category.set(category);
        this.categoryProducts.set(items);
        this.categoryLoading.set(false);
        this.titleService.setTitle(`${category.name} | Brotalia`);
        this.metaService.updateTag({
          name: 'description',
          content: `${category.name}: catálogo de macetas biodegradables de Brotalia. Envíos a todo el país.`,
        });
      },
      error: (err) => {
        this.categoryLoading.set(false);
        this.error.set(
          err?.status === 404
            ? 'No encontramos esa categoría.'
            : 'No se pudieron cargar los productos.',
        );
      },
    });
  }
}
