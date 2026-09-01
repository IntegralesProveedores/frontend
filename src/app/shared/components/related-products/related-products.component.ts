import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../product-card-skeleton/product-card-skeleton.component';

@Component({
  selector: 'app-related-products',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, ProductCardSkeletonComponent],
  templateUrl: './related-products.component.html',
  styleUrl: './related-products.component.css',
})
export class RelatedProductsComponent {
  /** La lista ya resuelta por la página (filtrada/limitada como corresponda ahí). Este componente no pide datos por su cuenta. */
  @Input() items: Product[] = [];
  @Input() loading = false;
  /** cart/checkout mostraban skeleton mientras cargaba; product-detail nunca lo mostró. */
  @Input() showSkeleton = true;
  /** Clases exactas del contenedor — distintas en cart/checkout (mt-5 pt-4) vs product-detail (mt-2 pt-2). */
  @Input() wrapperClass = 'related-products mt-5 pt-4 border-top';

  readonly skeletonPlaceholders = [1, 2, 3, 4, 5];
}
