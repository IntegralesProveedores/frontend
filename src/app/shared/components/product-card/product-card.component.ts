import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product, ProductVariant } from '../../../core/models/product.model';
import { PricingConfigService } from '../../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { ProgressiveImageComponent } from '../progressive-image/progressive-image.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyArsPipe, ProgressiveImageComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  public readonly pricingConfigService = inject(PricingConfigService);

  get mainImage(): string {
    const img = this.product.images?.[0]?.url;
    return img || 'assets/images/placeholder.webp';
  }

  get variant(): ProductVariant | null {
	  const master = this.product.units_per_pack_master;
	  if (master) {
		return this.product.variants.find(v => v.units_per_pack === master) ?? this.product.variants[0] ?? null;
	  }
	  return this.product.variants[0] ?? null;
	}
}
