import { Component, Input, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { ProgressiveImageComponent } from '../progressive-image/progressive-image.component';

const HOVER_CAROUSEL_INTERVAL_MS = 1300;

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CurrencyArsPipe,
    ProgressiveImageComponent,
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent implements OnDestroy {
  @Input({ required: true }) product!: Product;
  public readonly pricingConfigService = inject(PricingConfigService);

  private readonly hoverImageIndex = signal(0);
  private carouselTimer: ReturnType<typeof setInterval> | null = null;

  get mainImage(): string {
    const images = this.product.images ?? [];
    const img = images[this.hoverImageIndex()]?.url ?? images[0]?.url;
    return img || 'assets/images/placeholder.webp';
  }

  get variant(): ProductVariant | null {
    const master = this.product.units_per_pack_master;
    if (master) {
      return (
        this.product.variants.find((v) => v.units_per_pack === master) ??
        this.product.variants[0] ??
        null
      );
    }
    return this.product.variants[0] ?? null;
  }

  onImageMouseEnter(): void {
    const images = this.product.images ?? [];
    if (images.length <= 1) return;

    this.stopCarousel();
    this.carouselTimer = setInterval(() => {
      this.hoverImageIndex.update((i) => (i + 1) % images.length);
    }, HOVER_CAROUSEL_INTERVAL_MS);
  }

  onImageMouseLeave(): void {
    this.stopCarousel();
    this.hoverImageIndex.set(0);
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  private stopCarousel(): void {
    if (this.carouselTimer !== null) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = null;
    }
  }
}
