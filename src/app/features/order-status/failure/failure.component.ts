import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CheckoutAttemptService } from '../../../core/services/checkout-attempt.service';
import { logError } from '../../../shared/utils/log.util';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-order-failure',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './failure.component.html',
  styleUrl: './failure.component.css',
})
export class FailureComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly checkoutAttemptService = inject(CheckoutAttemptService);

  /** Mercado Pago vuelve a esta página con `external_reference`: se cancela esa orden
   *  y se devuelve el stock, para que el reintento no deje stock retenido dos veces. */
  ngOnInit(): void {
    if (!this.isBrowser) return;
    const externalReference = this.route.snapshot.queryParamMap.get('external_reference');
    if (!externalReference || !UUID.test(externalReference)) return;

    // La orden de este intento se cancela: el reintento tiene que ser un intento nuevo
    // (con la misma key el backend encuentra la orden cancelada y rechaza el pago).
    this.checkoutAttemptService.clear();
    this.api
      .post('/orders/abandon', { external_reference: externalReference })
      .subscribe({ error: (error) => logError('No se pudo liberar la orden:', error) });
  }
}
