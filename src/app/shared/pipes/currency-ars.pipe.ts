import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyArs',
  standalone: true
})
export class CurrencyArsPipe implements PipeTransform {
  transform(value: number | string | undefined | null): string {
    if (value === null || value === undefined) return '$ 0';
    
    const amount = typeof value === 'string' ? parseFloat(value) : value;
    
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('$', '$ ');
  }
}
