import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of, forkJoin } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { ShippingAddress, ShippingMethod } from '../../../core/models/order.model';
import { PostalCodeLookup, PostalCodeService } from '../../../core/services/postal-code.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { SHIPPING_TEXTS } from '../../constants/shipping-texts.constants';
import { isCabaProvince, isBuenosAiresProvince } from '../../utils/province.utils';

const EMPTY_ADDRESS: ShippingAddress = {
  recipient_name: '', postal_code: '', province: '', locality: '', county: '',
  street: '', street_number: '', floor: '', apartment: '', country: 'Argentina'
};

@Component({
  selector: 'app-shipping-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyArsPipe],
  templateUrl: './shipping-selector.component.html',
  styleUrl: './shipping-selector.component.css'
})
export class ShippingSelectorComponent implements OnInit {
  @Input() mode: 'compact' | 'full' = 'full';

  private readonly shippingService = inject(ShippingService);
  private readonly postalCodeService = inject(PostalCodeService);
  private readonly cartService = inject(CartService);
  private readonly postalCodeSubject = new Subject<string>();
  private lastPostalCode = '';

  readonly current = this.shippingService.current;
  readonly quote = this.shippingService.quote;
  readonly shippingCost = this.shippingService.shippingCost;
  readonly loadingPostalCode = signal(false);
  readonly postalCodeNotFound = signal(false);
  readonly streetNumberIsSN = signal(false);
  address: ShippingAddress = { ...EMPTY_ADDRESS };

  readonly texts = SHIPPING_TEXTS;
  readonly method = computed<ShippingMethod>(() => this.current().method ?? 'delivery');

  ngOnInit(): void {
    const existing = this.current();
    if (!existing.method) this.shippingService.setMethod('delivery');
    this.address = { ...EMPTY_ADDRESS, ...(existing.address ?? {}) };
    this.streetNumberIsSN.set(this.address.street_number === 'S/N');
    this.lastPostalCode = this.address.postal_code;
    this.postalCodeSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(cp => {
        if (!/^\d{4}$/.test(cp)) {
          this.loadingPostalCode.set(false);
          this.postalCodeNotFound.set(false);
          this.shippingService.setQuote(null);
          return of(null);
        }

        this.loadingPostalCode.set(true);
        this.postalCodeNotFound.set(false);
        return forkJoin({
          lookup: this.postalCodeService.lookup(cp).pipe(
            catchError(error => error.status === 404 ? of(null as PostalCodeLookup | null) : (() => { throw error; })())
          ),
          quote: this.postalCodeService.quote(cp, this.productGroups()).pipe(
            catchError(() => of({ postal_code: cp, zone: null, price_ars: null, boxes: [] }))
          )
        }).pipe(finalize(() => this.loadingPostalCode.set(false)));
      })
    ).subscribe(result => {
      if (!result) return;
      if (!result.lookup) {
        this.address.province = '';
        this.address.locality = '';
        this.address.county = '';
        this.postalCodeNotFound.set(true);
        this.persistAddress();
        this.shippingService.setQuote(null);
        return;
      }

      this.address.province = result.lookup.province;
      if (!this.address.county) this.address.county = result.lookup.county ?? '';
      this.address.country = result.lookup.country;
      this.postalCodeNotFound.set(false);
      this.persistAddress();
      this.shippingService.setQuote({ zone: result.quote.zone, price_ars: result.quote.price_ars, boxes: result.quote.boxes }, result.quote.postal_code);
    });

    if (this.address.postal_code && !this.shippingService.hasValidQuote(this.address.postal_code)) {
      this.postalCodeSubject.next(this.address.postal_code);
    }
  }

  private productGroups(): Array<{ productId: string; units: number }> {
    const groups = new Map<string, number>();
    for (const item of this.cartService.cartItems()) groups.set(item.productId, (groups.get(item.productId) ?? 0) + item.quantity * (item.units_per_pack || 1));
    return Array.from(groups, ([productId, units]) => ({ productId, units }));
  }

  selectMethod(method: ShippingMethod): void {
    this.shippingService.setMethod(method);
    if (method === 'delivery') {
      this.address = { ...EMPTY_ADDRESS, ...(this.current().address ?? {}) };
      this.streetNumberIsSN.set(this.address.street_number === 'S/N');
      if (this.address.postal_code && !this.shippingService.hasValidQuote(this.address.postal_code)) {
        this.postalCodeSubject.next(this.address.postal_code);
      }
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
    this.lastPostalCode = normalized;
    this.postalCodeSubject.next(normalized);
  }

  updateAddress(field: keyof ShippingAddress, value: string): void {
    this.address = { ...this.address, [field]: value };
    this.persistAddress();
  }

  toggleStreetNumberSN(checked: boolean): void {
    this.streetNumberIsSN.set(checked);
    this.updateAddress('street_number', checked ? 'S/N' : '');
  }

  private persistAddress(): void {
    this.shippingService.setAddress({ ...this.address });
  }

  get addressFieldsVisible(): boolean {
    return /^\d{4}$/.test(this.address.postal_code) && !this.loadingPostalCode() && !this.postalCodeNotFound() && !!this.address.province.trim();
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
