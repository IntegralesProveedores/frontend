import {
  Component,
  computed,
  OnInit,
  OnDestroy,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { CustomerDraftService } from '../../../core/services/customer-draft.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { PaymentTransferInfo } from '../../../core/services/api.service';
import { logError } from '../../../shared/utils/log.util';
import { BUSINESS_WHATSAPP_URL } from '../../../shared/constants/contact.constants';

type OrderSuccessState = {
  orderRef?: string;
  paymentMethod?: 'mercadopago' | 'transferencia';
  transferInfo?: PaymentTransferInfo | null;
};

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './success.component.html',
  styleUrl: './success.component.css',
})
export class SuccessComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly whatsappUrl = BUSINESS_WHATSAPP_URL;
  readonly orderRef = signal<string | null>(null);
  readonly paymentMethod = signal<OrderSuccessState['paymentMethod'] | null>(
    null,
  );
  readonly transferInfo = signal<PaymentTransferInfo | null>(null);
  readonly copiedField = signal<string | null>(null);

  readonly transferRows = computed(() => {
    const info = this.transferInfo();
    if (!info) return [];
    return [
      { field: 'order', label: 'Número de orden', value: this.orderRef() ?? '', copy: true },
      { field: 'alias', label: 'Alias', value: info.alias, copy: true },
      ...(info.cvu
        ? [{ field: 'cvu', label: 'CVU', abbr: 'Clave Virtual Uniforme', value: info.cvu, copy: true }]
        : []),
      ...(info.cbu
        ? [{ field: 'cbu', label: 'CBU', abbr: 'Clave Bancaria Uniforme', value: info.cbu, copy: true }]
        : []),
      { field: 'holder', label: 'Titular', value: info.account_holder_name, copy: false },
    ] as { field: string; label: string; abbr?: string; value: string; copy: boolean }[];
  });
  private copiedFieldTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cartService: CartService,
    private readonly shippingService: ShippingService,
    private readonly customerDraftService: CustomerDraftService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  ngOnInit(): void {
    if (this.isBrowser) {
      const state = (history.state ?? {}) as OrderSuccessState;
      this.orderRef.set(state.orderRef ?? null);
      this.paymentMethod.set(state.paymentMethod ?? null);
      this.transferInfo.set(state.transferInfo ?? null);
    }

    this.cartService.clear();
    this.shippingService.clear();
    this.customerDraftService.clear();
    this.paymentMethodService.clear();
  }

  ngOnDestroy(): void {
    if (this.copiedFieldTimer) clearTimeout(this.copiedFieldTimer);
  }

  get showTransferInfo(): boolean {
    return (
      this.paymentMethod() === 'transferencia' &&
      !!this.orderRef() &&
      !!this.transferInfo()
    );
  }

  async copyToClipboard(value: string, field: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      if (this.copiedFieldTimer) clearTimeout(this.copiedFieldTimer);
      this.copiedField.set(field);
      this.copiedFieldTimer = setTimeout(() => {
        this.copiedField.set(null);
        this.copiedFieldTimer = null;
      }, 1500);
    } catch (error) {
      logError('Error al copiar al portapapeles:', error);
    }
  }
}
