import { Injectable, signal, computed } from '@angular/core';
import { PricingConfig } from '../models/product.model';

const PRICING_CONFIG_KEY = 'pricing_config';

@Injectable({ providedIn: 'root' })
export class PricingConfigService {
  private readonly config = signal<PricingConfig | null>(null);
  readonly pricingConfig = this.config.asReadonly();
  readonly hasPricingConfig = computed(() => this.config() !== null);

  constructor() {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(PRICING_CONFIG_KEY);
      if (raw) {
        try {
          this.config.set(JSON.parse(raw));
        } catch {
          localStorage.removeItem(PRICING_CONFIG_KEY);
        }
      }
    }
  }

  setPricingConfig(value: PricingConfig | undefined | null): void {
    if (!value) return;
    this.config.set(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(value));
    }
  }
}
