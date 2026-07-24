import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ShippingAddress, ShippingMethod, ShippingSelection } from '../models/order.model';

const SHIPPING_KEY = 'shipping_selection';
const EMPTY: ShippingSelection = { method: null, address: null };

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly selection = signal<ShippingSelection>(EMPTY);

  readonly current = this.selection.asReadonly();

  readonly isValid = computed(() => {
    const s = this.selection();
    if (s.method === 'pickup') return true;
    if (s.method === 'delivery') {
      const a = s.address;
      return !!(a?.postal_code && a?.street && a?.street_number && a?.province && a?.locality);
    }
    return false;
  });

  constructor() {
    if (this.isBrowser) this.loadFromStorage();
  }

  setMethod(method: ShippingMethod): void {
    this.selection.update(s => ({ ...s, method, address: method === 'pickup' ? null : s.address }));
    this.saveToStorage();
  }

  setAddress(address: ShippingAddress): void {
    this.selection.update(s => ({ ...s, address }));
    this.saveToStorage();
  }

  clear(): void {
    this.selection.set(EMPTY);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (this.isBrowser) localStorage.setItem(SHIPPING_KEY, JSON.stringify(this.selection()));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SHIPPING_KEY);
      if (raw) this.selection.set(JSON.parse(raw));
    } catch {
      this.selection.set(EMPTY);
    }
  }
}
