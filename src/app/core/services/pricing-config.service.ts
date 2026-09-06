import { Injectable, signal, computed } from '@angular/core';
import { PricingConfig } from '../models/product.model';

const PRICING_CONFIG_KEY = 'pricing_config';

function isPricingConfig(value: unknown): value is PricingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['exchange_rate'] === 'number' &&
    typeof v['payment_commission_percentage'] === 'number' &&
    Array.isArray(v['taxes']) &&
    Array.isArray(v['volume_discounts'])
  );
}

@Injectable({ providedIn: 'root' })
export class PricingConfigService {
  private readonly config = signal<PricingConfig | null>(null);
  readonly pricingConfig = this.config.asReadonly();
  readonly paymentCommissionPercentage = computed(
    () => this.config()?.payment_commission_percentage ?? 0,
  );
  readonly hasPricingConfig = computed(() => this.config() !== null);
  readonly vatLabel = computed(() => {
    const taxes = this.config()?.taxes ?? [];
    const iva = taxes.find(
      (t) => t.name.toUpperCase() === 'IVA' && t.is_active,
    );

    return iva && iva.is_computable ? 'IVA Incluido' : 'IVA no incluido';
  });

  constructor() {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(PRICING_CONFIG_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isPricingConfig(parsed)) {
            this.config.set(parsed);
          } else {
            localStorage.removeItem(PRICING_CONFIG_KEY);
          }
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
