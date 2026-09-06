import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { PaymentTransferInfo } from '../../../core/services/api.service';

type OrderSuccessState = {
  orderRef?: string;
  paymentMethod?: 'mercadopago' | 'transferencia';
  transferInfo?: PaymentTransferInfo | null;
};

const BUSINESS_WHATSAPP_URL = 'https://wa.me/5491130226565';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  private copiedFieldTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cartService: CartService,
    private readonly shippingService: ShippingService,
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
      console.error('Error al copiar al portapapeles:', error);
    }
  }
}
