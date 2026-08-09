import { Component, inject, effect, OnInit, OnDestroy, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom, Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { SessionContextService } from '../../core/services/session-context.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { MercadoPagoService } from '../../core/services/mercadopago.service';
import { ShippingService } from '../../core/services/shipping.service';
import { CustomerDraftService } from '../../core/services/customer-draft.service';
import { ShippingAddress, ShippingMethod } from '../../core/models/order.model';
import { PostalCodeService, PostalCodeLookup } from '../../core/services/postal-code.service';
import { PaymentMethodService } from '../../core/services/payment-method.service';

import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';
import { OrderSummaryComponent } from '../../shared/components/order-summary/order-summary.component';
import { environment } from '../../../environments/environment';
import * as emailjs from '@emailjs/browser';

type ValidatedOrder = {
  items: Array<{
    sku: string;
    product_name: string;
    quantity: number;
    units_per_pack: number;
    price_usd: number;
    subtotal_usd: number;
    price_ars: number;
    subtotal_ars: number;
  }>;
  total_ars: number;
  shipping_ars: number;
  total_usd: number;
  exchange_rate: number;
  order_ref: string;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyArsPipe, ProductCardComponent, ProductCardSkeletonComponent, OrderSummaryComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})

export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  public readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);
  public readonly session = inject(SessionContextService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly mercadoPagoService = inject(MercadoPagoService);
  private readonly postalCodeService = inject(PostalCodeService);
  private readonly customerDraftService = inject(CustomerDraftService);
  public readonly paymentMethodService = inject(PaymentMethodService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  public readonly shippingService = inject(ShippingService);
  private skipDraftPersistence = false;


  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  loading = false;
  paymentLoading = false;
  formSubmitted = false;
  shipping = this.shippingService.current; 
  shippingMethod = signal<ShippingMethod | null>('delivery');
  shippingFormSubmitted = false;
  loadingPostalCode = signal(false);
  postalCodeNotFound = signal(false);
  private readonly postalCodeSubject = new Subject<string>();
  private lastPostalCode = '';
  readonly totalUnits = computed(() => Math.round(1000 * this.cartService.cartItems().reduce(
    (sum, item) => sum + (item.quantity * (item.units_per_pack || 1)) / (item.units_per_pack_master || 1),
    0
  )));

  readonly shippingCost = computed(() => this.shippingMethod() === 'delivery'
    ? (this.shippingService.quote()?.price_ars ?? null)
    : 0);

  // TODO: sumar shipping_amount al total real de la orden en el backend (fase pendiente).
  readonly totalConEnvio = computed(() => this.cartService.subtotalArs() + (this.shippingCost() ?? 0));

  address: ShippingAddress = {
    recipient_name: '', postal_code: '', province: '', locality: '', county: '',
    street: '', street_number: '', floor: '', apartment: '', country: 'Argentina'
  };

  customer = {
    nombre: '',
    email: '',
    cuit: '',
    codigoArea: '',
    celular: ''
  };

  constructor() {
    effect(() => {
      const user = this.session.currentUser();
      if (user) {
        this.customer = {
          nombre: user.fullName,
          email: user.email,
          cuit: user.taxId,
          codigoArea: user.phone.areaCode,
          celular: user.phone.number
        };
      }

    });
  }

  get addressFieldsVisible(): boolean {
    return /^\d{4}$/.test(this.address.postal_code)
      && !this.loadingPostalCode()
      && !this.postalCodeNotFound()
      && !!this.address.province.trim();
  }

  get isCabaProvince(): boolean {
    const province = this.address.province.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return province === 'ciudad autonoma de buenos aires' || province === 'caba';
  }

  private getTotalUnits(): number {
    return this.totalUnits();
  }

  ngOnInit(): void {
    if (!this.session.isAuthenticated()) {
      const draft = this.customerDraftService.current();
      if (draft) Object.assign(this.customer, draft);
    }

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
            catchError(error => {
              if (error.status === 404) return of(null as PostalCodeLookup | null);
              throw error;
            })
          ),
          quote: this.postalCodeService.quote(cp, this.getTotalUnits()).pipe(
            catchError(() => of({ postal_code: cp, zone: null, price_ars: null, boxes: [] }))
          )
        }).pipe(finalize(() => this.loadingPostalCode.set(false)));
      })
    ).subscribe({
      next: result => {
        if (!result) return;
        if (!result.lookup) {
          this.address.province = '';
          this.address.locality = '';
          this.address.county = '';
          this.postalCodeNotFound.set(true);
          this.shippingService.setQuote(null);
          return;
        }

        this.address.province = result.lookup.province;
        if (!this.address.locality) this.address.locality = result.lookup.locality;
        if (!this.address.county) this.address.county = result.lookup.county ?? '';
        this.address.country = result.lookup.country;
        this.postalCodeNotFound.set(false);
        this.shippingService.setQuote({ zone: result.quote.zone, price_ars: result.quote.price_ars, boxes: result.quote.boxes });
      },
      error: error => {
        console.error('Error al consultar código postal:', error);
        this.shippingService.setQuote(null);
      }
    });

    this.productsService.getProducts().subscribe({
      error: error => console.error('Error al cargar otros productos:', error)
    });

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
    }
  
    const existing = this.shippingService.current();
    if (existing.method) {
      this.shippingMethod.set(existing.method);
    } else {
      this.shippingService.setMethod(this.shippingMethod()!);
    }
    if (existing.address) this.address = { ...existing.address };
    this.lastPostalCode = this.address.postal_code;
    if (this.address.postal_code) this.postalCodeSubject.next(this.address.postal_code);
  
  }

  onPostalCodeChange(postalCode: string): void {
    const normalized = postalCode.replace(/\D/g, '').slice(0, 4);
    const isNewCompletePostalCode = normalized !== this.lastPostalCode
      && /^\d{4}$/.test(normalized)
      && /^\d{4}$/.test(this.lastPostalCode);

    if (isNewCompletePostalCode) {
      this.address.locality = '';
      this.address.county = '';
    }

    if (normalized !== postalCode) this.address.postal_code = normalized;
    this.postalCodeSubject.next(normalized);
    this.lastPostalCode = normalized;
  }

  filterNumericInput(event: Event, field: 'codigoArea' | 'celular'): void {
    const input = event.target as HTMLInputElement;
    const maxLength = field === 'codigoArea' ? 4 : 8;
    const value = input.value.replace(/\D/g, '').slice(0, maxLength);
    if (input.value !== value) input.value = value;
    this.customer[field] = value;
  }

  onCuitInput(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);

    let formatted = '';
    if (value.length > 0) {
      formatted = value.substring(0, 2);
      if (value.length > 2) {
        formatted += '-' + value.substring(2, 10);
        if (value.length > 10) {
          formatted += '-' + value.substring(10, 11);
        }
      }
    }
    this.customer.cuit = formatted;
  }

  private escapeHtml(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

private generarSeccionEnvio(): string {
  if (this.shippingMethod() === 'coordinar') {
    return `
      <div style="margin-top: 25px; padding: 18px; background-color: #f0f7ff; border-radius: 6px; border-left: 4px solid #2b5e2b;">
        <p style="margin: 0 0 10px; color: #2b5e2b; font-weight: bold; font-size: 15px;">💬 Coordinemos tu envío</p>
        <p style="margin: 0 0 10px; font-size: 13px; color: #444; line-height: 1.5;">
          Escribinos por WhatsApp al <strong>+54 9 11 3022-6565</strong> para coordinar
          el método de envío (transporte, micro o expreso), el costo y los tiempos según tu localidad.
        </p>
        <p style="margin: 0 0 10px; font-size: 13px; color: #444;">El costo de envío se coordina por WhatsApp según transporte y destino.</p>
        <p style="margin: 0; font-size: 12px; color: #777;">
          Te respondemos de lunes a jueves de 10 a 14 hs. Los mensajes fuera de ese horario
          se responden el día hábil siguiente dentro del horario indicado.
        </p>
      </div>
    `;
  }

  if (this.shippingMethod() === 'pickup') {
    return `
      <div style="margin-top: 25px; padding: 18px; background-color: #f0f7ff; border-radius: 6px; border-left: 4px solid #2b5e2b;">
        <p style="margin: 0 0 10px; color: #2b5e2b; font-weight: bold; font-size: 15px;">
          📦 Coordiná tu retiro
        </p>
        <p style="margin: 0 0 10px; font-size: 13px; color: #444; line-height: 1.5;">
          Escribinos por WhatsApp al <strong>+54 9 11 3022-6565</strong> para coordinar
          día, horario y punto de retiro. Podés retirar en
          <strong>Portela 875, Flores, CABA</strong> o en
          <strong>Roosevelt 1935, Belgrano, CABA</strong>, según disponibilidad.
        </p>
        <p style="margin: 0; font-size: 12px; color: #777;">
          Atendemos de lunes a jueves de 10 a 14 hs. Los mensajes enviados fuera de
          ese horario se responden el día hábil siguiente dentro del horario indicado.
        </p>
      </div>
    `;
  }

  const a = this.address;
  const direccionCompleta = [
    `${this.escapeHtml(a.street)} ${this.escapeHtml(a.street_number)}`,
    a.floor ? `Piso ${this.escapeHtml(a.floor)}` : null,
    a.apartment ? `Depto ${this.escapeHtml(a.apartment)}` : null
  ].filter(Boolean).join(', ');

  return `
    <div style="margin-top: 25px;">
      <h3 style="color: #2b5e2b; font-size: 15px; margin-bottom: 10px;">DIRECCIÓN DE ENVÍO</h3>
      <table width="100%" style="border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #666; width: 140px;">Destinatario:</td>
          <td style="padding: 4px 0; color: #333;">${this.escapeHtml(a.recipient_name)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Dirección:</td>
          <td style="padding: 4px 0; color: #333;">${direccionCompleta}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Localidad:</td>
          <td style="padding: 4px 0; color: #333;">${this.escapeHtml(a.locality)}${a.county ? ` (${this.escapeHtml(a.county)})` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Provincia:</td>
          <td style="padding: 4px 0; color: #333;">${this.escapeHtml(a.province)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Código Postal:</td>
          <td style="padding: 4px 0; color: #333;">${this.escapeHtml(a.postal_code)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Costo de envío:</td>
          <td style="padding: 4px 0; color: #333;">$${this.fmtNumber(this.shippingCost() ?? 0)}</td>
        </tr>
      </table>
    </div>
  `;
}

private generarSeccionPagoTransferencia(): string {
  return `
    <div style="margin-top: 25px;">
      <h3 style="color: #2b5e2b; font-size: 15px; margin-bottom: 10px;">FORMA DE PAGO: TRANSFERENCIA</h3>
      <table width="100%" style="border-collapse: collapse; font-size: 13px; margin-bottom: 12px;">
        <tr>
          <td style="padding: 10px; background-color: #f8f9fa; border: 1px solid #eee;" colspan="2">
            <strong style="color: #2b5e2b;">Mercado Pago</strong>
          </td>
        </tr>
        <tr><td style="padding: 4px 10px; color: #666;">Alias:</td><td style="padding: 4px 10px;">brotalia</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">CVU:</td><td style="padding: 4px 10px;">0000003100047366574097</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">Titular:</td><td style="padding: 4px 10px;">Luciano German Farina</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">CUIT:</td><td style="padding: 4px 10px;">24304556605</td></tr>
      </table>
      <table width="100%" style="border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 10px; background-color: #f8f9fa; border: 1px solid #eee;" colspan="2">
            <strong style="color: #2b5e2b;">Banco Nacion</strong>
          </td>
        </tr>
        <tr><td style="padding: 4px 10px; color: #666;">Alias:</td><td style="padding: 4px 10px;">farinagerman.bna</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">CBU:</td><td style="padding: 4px 10px;">0110006830000620409251</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">Titular:</td><td style="padding: 4px 10px;">Luciano Germán Farina</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">CUIT:</td><td style="padding: 4px 10px;">24304556605</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">Cuenta:</td><td style="padding: 4px 10px;">CA $ N°00300062040925</td></tr>
      </table>
      <div style="margin-top: 15px; padding: 15px; background-color: #e9f7ef; border-radius: 4px; text-align: center;">
        <p style="margin: 0; color: #1e7e34; font-weight: bold; font-size: 13px;">
          Recibido o acreditado el pago se procesa el pedido. El comprobante
          podés enviarlo por WhatsApp al +54 9 11 3022-6565.
        </p>
      </div>
    </div>
  `;
}

private generarHTMLCorreo(order: ValidatedOrder): string {
  const c = this.customer;

  let html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #2b5e2b; text-align: center;">DETALLE DEL PEDIDO</h2>
      <hr style="border: 0; border-top: 1px solid #eee;">
      <p><strong>Cliente:</strong> ${this.escapeHtml(c.nombre)}</p>
      <p><strong>CUIT:</strong> ${this.escapeHtml(c.cuit) || 'No informado'}</p>
      <p><strong>Teléfono:</strong> (${this.escapeHtml(c.codigoArea)}) ${this.escapeHtml(c.celular)}</p>
      <p><strong>Email:</strong> ${this.escapeHtml(c.email)}</p>

<table width="100%" style="border-collapse: collapse; margin-top: 20px; font-size: 10px;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Producto</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Unidad</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Cant.</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
  `;

  order.items.forEach(item => {
    const priceArs = item.price_ars || 0;
    const subtotalItemArs = item.subtotal_ars || (priceArs * item.quantity);
    const unitsPerPack = item.units_per_pack || 1;

    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">
          <strong style="color: #2b5e2b;">${this.escapeHtml(item.product_name)}</strong><br>
          <span style="font-size: 0.7em; color: #666;">PackX${unitsPerPack}u.</span><br>
          <span style="font-size: 0.7em; color: #888;">SKU: ${this.escapeHtml(item.sku)}</span>
        </td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">$${this.fmtNumber(priceArs)}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">$${this.fmtNumber(subtotalItemArs)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
  `;

  html += this.generarSeccionEnvio();
  html += this.generarSeccionPagoTransferencia();

  html += `
      <div style="margin-top: 30px; text-align: right; border-top: 2px solid #eee; padding-top: 15px;">
        ${order.shipping_ars > 0 ? `
        <div style="margin-bottom: 5px;">
          <span style="font-size: 14px; color: #666;">Envío</span>
          <span style="font-size: 14px; color: #666; margin-left: 10px;">$${this.fmtNumber(order.shipping_ars)}</span>
        </div>` : ''}
        <div style="margin-bottom: 5px;">
          <span style="font-size: 14px; color: #666; font-weight: bold;">TOTAL</span>
          <span style="font-size: 22px; color: #2b5e2b; font-weight: bold; margin-left: 10px;">$${this.fmtNumber(order.total_ars)}</span>
        </div>
        <div style="color: #999; font-size: 11px; font-style: italic;">
          ${this.pricingConfigService.vatLabel()}
        </div>
      </div>

      <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px; text-align: center;">
        <p style="margin: 0; color: #2b5e2b; font-weight: bold;">¡Gracias por tu compra!</p>
      </div>
    </div>
  `;

  return html;
}



  async confirmarPedido(isValid: boolean | null) {
    this.formSubmitted = true;
	this.shippingFormSubmitted = true;

    if (this.shippingMethod() === 'delivery') {
      this.address.recipient_name = this.customer.nombre;
    }

    if (!isValid || !this.shippingValid || this.cartService.isEmpty()) {
      return;
    }

    if (this.shippingMethod() === 'delivery') {
      this.shippingService.setAddress({ ...this.address });
    }

    this.loading = true;
    const c = this.customer;
    const cartItems = this.cartService.cartItems();

    try {
      if (this.shippingMethod() === 'delivery') {
        this.address.recipient_name = this.customer.nombre;
      }

      const payload = {
        items: cartItems.map(i => ({
          variant_id: i.variantId,
          quantity: i.quantity
        })),
        customer: {
          nombre: c.nombre,
          email: c.email,
          cuit: c.cuit,
          codigoArea: c.codigoArea,
          celular: c.celular
        },
        shipping: {
          method: this.shippingMethod()!,
          ...(this.shippingMethod() === 'delivery' ? { address: { ...this.address } } : {})
        }
      };

      const order = await firstValueFrom(
        this.api.post<ValidatedOrder>('/orders', payload)
      );

      const mensajeHTML = this.generarHTMLCorreo(order);

      const templateParams = {
        to_name: c.nombre,
        to_email: c.email,
        name: c.nombre,
        reply_to: c.email,
        email: c.email,
        telefono: `(${c.codigoArea}) ${c.celular}`,
        order_id: order.order_ref,
        mensaje_html: mensajeHTML
      };

      await emailjs.send(
        environment.emailjs.serviceId,
        environment.emailjs.templateId,
        templateParams,
        environment.emailjs.publicKey
      );

      this.skipDraftPersistence = true;
      this.cartService.clear();
      this.customerDraftService.clear();
      this.shippingService.clear();
      this.paymentMethodService.clear();
      this.router.navigate(['/orden/exito']);
    } catch (error) {
      console.error('Error en checkout:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.loading = false;
    }
  }

  async iniciarPagoMercadoPago(isValid: boolean | null): Promise<void> {
    this.formSubmitted = true;
	this.shippingFormSubmitted = true;

    if (this.shippingMethod() === 'delivery') {
      this.address.recipient_name = this.customer.nombre;
    }

    if (!isValid || !this.shippingValid || this.cartService.isEmpty()) {
      return;
    }

    if (this.shippingMethod() === 'delivery') {
      this.shippingService.setAddress({ ...this.address });
    }

    this.paymentLoading = true;
    const c = this.customer;

    try {
      if (this.shippingMethod() === 'delivery') {
        this.address.recipient_name = this.customer.nombre;
      }

      await this.mercadoPagoService.startCheckout({
        items: this.cartService.cartItems().map(item => ({
          variant_id: item.variantId,
          quantity: item.quantity
        })),
        customer: {
          nombre: c.nombre,
          email: c.email,
          cuit: c.cuit,
          codigoArea: c.codigoArea,
          celular: c.celular
        },
        shipping: {
          method: this.shippingMethod()!,
          ...(this.shippingMethod() === 'delivery' ? { address: { ...this.address } } : {})
        }
      });

      this.skipDraftPersistence = true;
      this.customerDraftService.clear();
      this.shippingService.clear();
      this.paymentMethodService.clear();
    } catch (error) {
      console.error('Error al iniciar Mercado Pago:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.paymentLoading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.skipDraftPersistence) return;

    if (!this.session.isAuthenticated()) {
      this.customerDraftService.setCustomer({ ...this.customer });
    }

    if (this.shippingMethod() === 'delivery') {
      this.shippingService.setAddress({ ...this.address });
    }
  }

  async pagarAhora(isValid: boolean | null): Promise<void> {
    const method = this.paymentMethodService.current();
    if (!method) {
      this.formSubmitted = true;
      return;
    }

    if (method === 'mercadopago') {
      await this.iniciarPagoMercadoPago(isValid);
      return;
    }

    await this.confirmarPedido(isValid);
  }

  selectPaymentMethod(method: 'mercadopago' | 'transferencia'): void {
    this.paymentMethodService.setMethod(method);
  }

  selectShippingMethod(method: ShippingMethod): void {
    this.shippingMethod.set(method);
    this.shippingService.setMethod(method);
  }

  get shippingValid(): boolean {
    if (this.shippingMethod() === 'pickup' || this.shippingMethod() === 'coordinar') return true;
    if (this.shippingMethod() === 'delivery') {
      const a = this.address;
      return !!(
        a.recipient_name &&
        this.addressFieldsVisible &&
        a.street &&
        a.street_number &&
        (this.isCabaProvince || a.locality)
      );
    }
    return false;
  }



  fmtNumber(n: number) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);
  }
}
