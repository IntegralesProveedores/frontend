import { Injectable } from '@angular/core';

export interface PriceBreakdown {
  baseCost: number;
  quantity: number;
  discountFactor: number;
  costWithDiscount: number;
  marginFactor: number;
  ivaFactor: number;
  finalPriceUsd: number;
  finalPriceArs: number;
  breakdown: {
    discountedCost: number;
    marginAmount: number;
    ivaAmount: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  // Constantes de configuración para fácil mantenimiento
  private readonly MARGIN_FACTOR = 1.20;
  private readonly IVA_FACTOR = 1;

  /**
   * Calcula el precio detallado basado en el costo USD y la cantidad.
   * Sigue la lógica exacta de Excel: Redondeo a 2 decimales en cada paso.
   */
  calculatePrice(costUsd: number | undefined | null, quantity: number = 1, exchangeRate: number = 1): PriceBreakdown {
    const baseCost = costUsd || 0;
    const qty = quantity > 0 ? quantity : 1;
    const rate = exchangeRate || 1;

    const discountFactor = this.getDiscountFactor(qty);
    
    // Paso 1: Aplicar descuento por volumen y redondear
    const costWithDiscount = this.round(baseCost / discountFactor);
    
    // Paso 2: Aplicar rentabilidad (20%) y redondear
    const priceWithMargin = this.round(costWithDiscount * this.MARGIN_FACTOR);
    
    // Paso 3: Calcular IVA (21%) y redondear
    const ivaAmount = this.round(priceWithMargin * (this.IVA_FACTOR - 1));
    
    // Paso 4: Precio final USD
    const finalPriceUsd = this.round(priceWithMargin + ivaAmount);
    
    // Paso 5: Precio final ARS (Tipo de cambio)
    const finalPriceArs = Math.round(finalPriceUsd * rate);

    return {
      baseCost,
      quantity: qty,
      discountFactor,
      costWithDiscount,
      marginFactor: this.MARGIN_FACTOR,
      ivaFactor: this.IVA_FACTOR,
      finalPriceUsd,
      finalPriceArs,
      breakdown: {
        discountedCost: costWithDiscount,
        marginAmount: priceWithMargin - costWithDiscount,
        ivaAmount: ivaAmount
      }
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Obtiene el factor de descuento según la cantidad (Bulk Pricing)
   * Ajustado para coincidir con Excel: 47 / 1.05 = 44.76
   */
  private getDiscountFactor(quantity: number): number {
    if (quantity >= 31) return 1.25;
    if (quantity >= 21) return 1.20;
    if (quantity >= 11) return 1.15;
    if (quantity >= 6) return 1.10;
    if (quantity >= 3) return 1.05;
    return 1; // 1 a 10 unidades
  }
}
