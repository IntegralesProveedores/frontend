import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyArs',
  standalone: true
})
export class CurrencyArsPipe implements PipeTransform {
  transform(value: number | string | undefined | null): string {
    if (value === undefined || value === null) return '';
    
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(val)) return '';

    const formatter = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return `ARS $ ${formatter.format(val)}`;
  }
}


