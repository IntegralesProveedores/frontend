import {
  Component,
  computed,
  DestroyRef,
  OnInit,
  OnDestroy,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap, take, takeWhile, timer } from 'rxjs';
import { MercadoPagoService } from '../../../core/services/mercadopago.service';
import { OrderPaymentState } from '../../../core/models/payment.model';
import { CartService } from '../../../core/services/cart.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { CustomerDraftService } from '../../../core/services/customer-draft.service';
import { CheckoutAttemptService } from '../../../core/services/checkout-attempt.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { PaymentTransferInfo } from '../../../core/services/api.service';
import { logError } from '../../../shared/utils/log.util';
import { BUSINESS_WHATSAPP_URL } from '../../../shared/constants/contact.constants';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_POLL_MS = 3000;
const PAYMENT_POLL_ATTEMPTS = 5;

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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mercadoPagoService = inject(MercadoPagoService);
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
    private readonly checkoutAttemptService: CheckoutAttemptService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  /** Llegó de una compra real: transferencia (estado de navegación) o vuelta de Mercado Pago. */
  readonly hasPurchase = computed(() => this.paymentMethod() !== null);
  /** La página se prerenderiza: el mensaje se decide recién en el navegador, sin parpadeo. */
  readonly checked = signal(false);
  /** Estado del pago de Mercado Pago según el backend ('checking' mientras se consulta). */
  readonly mpState = signal<OrderPaymentState | 'checking'>('checking');

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.checked.set(true);

    const state = (history.state ?? {}) as OrderSuccessState;
    if (state.orderRef) {
      this.orderRef.set(state.orderRef);
      this.paymentMethod.set(state.paymentMethod ?? null);
      this.transferInfo.set(state.transferInfo ?? null);
    } else {
      // Mercado Pago vuelve con ?external_reference=... El estado que trae la URL no se
      // usa: se le pregunta al backend, que lo sabe por el webhook.
      const externalReference =
        this.route.snapshot.queryParamMap.get('external_reference');
      if (externalReference && UUID.test(externalReference)) {
        this.orderRef.set(externalReference);
        this.paymentMethod.set('mercadopago');
        this.watchPaymentState(externalReference);
      }
    }

    // Entrar a /orden/exito a mano no tiene que vaciar el carrito.
    if (!this.hasPurchase()) return;
    this.cartService.clear();
    this.shippingService.clear();
    this.customerDraftService.clear();
    this.checkoutAttemptService.clear();
    this.paymentMethodService.clear();
  }

  /**
   * El webhook de Mercado Pago puede llegar unos segundos después que el cliente: se
   * consulta hasta 5 veces, cada 3 s. Si sigue pendiente (o la consulta falla), el
   * cliente recibe el aviso por correo cuando se acredite.
   */
  private watchPaymentState(externalReference: string): void {
    timer(0, PAYMENT_POLL_MS)
      .pipe(
        take(PAYMENT_POLL_ATTEMPTS),
        switchMap(() =>
          this.mercadoPagoService
            .getPaymentState(externalReference)
            .pipe(catchError(() => of<OrderPaymentState>('pending'))),
        ),
        takeWhile((state) => state === 'pending', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          if (state !== 'pending') this.mpState.set(state);
        },
        complete: () => {
          if (this.mpState() === 'checking') this.mpState.set('pending');
        },
      });
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
