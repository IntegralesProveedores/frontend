import {
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of, forkJoin } from 'rxjs';
import {
  catchError,
  debounceTime,
  finalize,
  map,
  switchMap,
} from 'rxjs/operators';
import {
  ShippingAddress,
  ShippingMethod,
} from '../../../core/models/order.model';
import {
  PostalCodeLookup,
  PostalCodeService,
} from '../../../core/services/postal-code.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { SHIPPING_TEXTS } from '../../constants/shipping-texts.constants';
import { BUSINESS_PHONE_DISPLAY } from '../../constants/contact.constants';
import {
  isCabaProvince,
  isBuenosAiresProvince,
} from '../../utils/province.utils';

const EMPTY_ADDRESS: ShippingAddress = {
  recipient_name: '',
  postal_code: '',
  province: '',
  locality: '',
  county: '',
  street: '',
  street_number: '',
  floor: '',
  apartment: '',
  country: 'Argentina',
};

@Component({
  selector: 'app-shipping-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyArsPipe],
  templateUrl: './shipping-selector.component.html',
  styleUrl: './shipping-selector.component.css',
})
export class ShippingSelectorComponent implements OnInit {
  @Input() mode: 'compact' | 'full' = 'full';
  @Input() formSubmitted = false;

  readonly phoneDisplay = BUSINESS_PHONE_DISPLAY;

  private readonly shippingService = inject(ShippingService);
  private readonly postalCodeService = inject(PostalCodeService);
  private readonly cartService = inject(CartService);
  private readonly postalCodeSubject = new Subject<string>();
  /** Código postal para el que ya se cargó `provinceOptions`. */
  private provinceOptionsCp = '';

  readonly current = this.shippingService.current;
  readonly quote = this.shippingService.quote;
  readonly shippingCost = this.shippingService.shippingCost;
  readonly loadingPostalCode = signal(false);
  readonly postalCodeNotFound = signal(false);
  /** Provincias del código postal ingresado; más de una solo en códigos compartidos. */
  readonly provinceOptions = signal<string[]>([]);
  readonly quoteMissing = this.shippingService.quoteMissing;
  readonly quoting = this.shippingService.quoting;
  readonly streetNumberIsSN = signal(false);
  readonly showObservaciones = signal(false);
  address: ShippingAddress = { ...EMPTY_ADDRESS };

  readonly texts = SHIPPING_TEXTS;
  readonly method = computed<ShippingMethod>(
    () => this.current().method ?? 'delivery',
  );

  ngOnInit(): void {
    const existing = this.current();
    if (!existing.method) this.shippingService.setMethod('delivery');
    this.address = { ...EMPTY_ADDRESS, ...(existing.address ?? {}) };
    this.streetNumberIsSN.set(this.address.street_number === 'S/N');
    this.showObservaciones.set(!!this.address.observations);
    this.postalCodeSubject
      .pipe(
        debounceTime(400),
        switchMap((cp) => {
          if (!/^\d{4}$/.test(cp)) {
            this.loadingPostalCode.set(false);
            this.postalCodeNotFound.set(false);
            this.provinceOptions.set([]);
            this.provinceOptionsCp = '';
            this.shippingService.setQuote(null);
            return of(null);
          }

          this.loadingPostalCode.set(true);
          this.postalCodeNotFound.set(false);
          // Carrito con el que se pide la cotización (ver ShippingService.setQuote).
          const requestCart = this.shippingService.cartKeyForRequest();
          return forkJoin({
            lookup: this.postalCodeService.lookup(cp, this.address.province || undefined).pipe(
              catchError((error) =>
                error.status === 404
                  ? of(null as PostalCodeLookup | null)
                  : (() => {
                      throw error;
                    })(),
              ),
            ),
            quote: this.quoteFor(cp).pipe(
              catchError(() =>
                of({
                  postal_code: cp,
                  zone: null,
                  price_ars: null,
                }),
              ),
            ),
          }).pipe(
            finalize(() => this.loadingPostalCode.set(false)),
            map((result) => ({ ...result, requestCart })),
          );
        }),
      )
      .subscribe((result) => {
        if (!result) return;
        if (!result.lookup) {
          this.address.province = '';
          this.address.locality = '';
          this.address.county = '';
          this.provinceOptions.set([]);
          this.provinceOptionsCp = '';
          this.postalCodeNotFound.set(true);
          this.persistAddress();
          this.shippingService.setQuote(null);
          return;
        }

        this.address.province = result.lookup.province;
        this.provinceOptions.set(result.lookup.provinces ?? []);
        this.provinceOptionsCp = result.lookup.postal_code;
        if (!this.address.county)
          this.address.county = result.lookup.county ?? '';
        this.address.country = result.lookup.country;
        this.postalCodeNotFound.set(false);
        this.persistAddress();
        this.shippingService.setQuote(
          {
            zone: result.quote.zone,
            price_ars: result.quote.price_ars,
          },
          result.quote.postal_code,
          result.requestCart,
        );
      });

    this.refreshPostalCode();
  }

  /**
   * Al crear el componente (o volver a "delivery") con un código ya cargado:
   * si la cotización sigue vigente no hace falta recotizar, pero sí volver a
   * consultar el código para saber si tiene más de una provincia (el selector
   * de provincia se recrea vacío al cambiar de página).
   */
  private refreshPostalCode(): void {
    const cp = this.address.postal_code;
    if (!/^\d{4}$/.test(cp)) return;
    if (!this.shippingService.hasValidQuote(cp)) {
      // Cotización vieja (cambió el carrito): no mostrar su precio mientras se recotiza.
      this.shippingService.setQuote(null);
      this.postalCodeSubject.next(cp);
      return;
    }
    if (this.provinceOptionsCp === cp) return;
    this.postalCodeService
      .lookup(cp, this.address.province || undefined)
      .subscribe({
        next: (lookup) => {
          this.provinceOptionsCp = cp;
          this.provinceOptions.set(lookup.provinces ?? []);
        },
        error: () => this.provinceOptions.set([]),
      });
  }

  /** Reutiliza la cotización si ya está vigente (mismo CP, provincia y carrito); si no, la pide. */
  private quoteFor(cp: string) {
    const current = this.shippingService.quote();
    if (current && this.shippingService.hasValidQuote(cp)) {
      return of({ postal_code: cp, ...current });
    }
    return this.shippingService.requestQuote(
      cp,
      this.productGroups(),
      this.address.province || undefined,
    );
  }

  private productGroups(): Array<{ productId: string; units: number }> {
    const groups = new Map<string, number>();
    for (const item of this.cartService.cartItems())
      groups.set(
        item.productId,
        (groups.get(item.productId) ?? 0) +
          item.quantity * (item.units_per_pack || 1),
      );
    return Array.from(groups, ([productId, units]) => ({ productId, units }));
  }

  selectMethod(method: ShippingMethod): void {
    this.shippingService.setMethod(method);
    if (method === 'delivery') {
      this.address = { ...EMPTY_ADDRESS, ...(this.current().address ?? {}) };
      this.streetNumberIsSN.set(this.address.street_number === 'S/N');
      this.refreshPostalCode();
    }
  }

  updatePostalCode(value: string): void {
    const normalized = value.replace(/\D/g, '').slice(0, 4);
    if (normalized !== this.address.postal_code) {
      this.address.province = '';
      this.address.locality = '';
      this.address.county = '';
      this.postalCodeNotFound.set(false);
      this.address.postal_code = normalized;
      this.persistAddress();
    }
    this.postalCodeSubject.next(normalized);
  }

  /** Códigos compartidos por varias provincias: el cliente elige y se vuelve a cotizar. */
  selectProvince(province: string): void {
    if (province === this.address.province) return;
    this.address = { ...this.address, province, locality: '', county: '' };
    this.persistAddress();
    this.postalCodeSubject.next(this.address.postal_code);
  }

  updateAddress(field: keyof ShippingAddress, value: string): void {
    this.address = { ...this.address, [field]: value };
    this.persistAddress();
  }

  toggleStreetNumberSN(checked: boolean): void {
    this.streetNumberIsSN.set(checked);
    this.updateAddress('street_number', checked ? 'S/N' : '');
  }

  onStreetNumberInput(event: Event): void {
    if (this.streetNumberIsSN()) return;
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    if (input.value !== value) input.value = value;
    this.updateAddress('street_number', value);
  }

  toggleObservaciones(checked: boolean): void {
    this.showObservaciones.set(checked);
    if (!checked) this.updateAddress('observations', '');
  }

  private persistAddress(): void {
    this.shippingService.setAddress({ ...this.address });
  }

  get addressFieldsVisible(): boolean {
    return (
      /^\d{4}$/.test(this.address.postal_code) &&
      !this.loadingPostalCode() &&
      !this.postalCodeNotFound() &&
      !!this.address.province.trim()
    );
  }

  get isCabaProvince(): boolean {
    return isCabaProvince(this.address.province);
  }

  get isBuenosAiresProvince(): boolean {
    return isBuenosAiresProvince(this.address.province);
  }

  get showLocalityField(): boolean {
    return this.addressFieldsVisible && !this.isCabaProvince;
  }

  get showCountyField(): boolean {
    return this.addressFieldsVisible && this.isBuenosAiresProvince;
  }
}
