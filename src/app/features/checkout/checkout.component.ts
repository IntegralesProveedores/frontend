import { Component, inject, effect, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ProductsService } from '../../core/services/products.service';
import { SessionContextService } from '../../core/services/session-context.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { MercadoPagoService } from '../../core/services/mercadopago.service';
import { ShippingService } from '../../core/services/shipping.service';
import { ShippingAddress, ShippingMethod } from '../../core/models/order.model';

import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../shared/components/product-card-skeleton/product-card-skeleton.component';
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
  total_usd: number;
  exchange_rate: number;
  order_ref: string;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyArsPipe, ProductCardComponent, ProductCardSkeletonComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})

export class CheckoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  public readonly cartService = inject(CartService);
  private readonly productsService = inject(ProductsService);
  public readonly session = inject(SessionContextService);
  public readonly pricingConfigService = inject(PricingConfigService);
  private readonly mercadoPagoService = inject(MercadoPagoService);
  public readonly shippingService = inject(ShippingService);


  products = this.productsService.products;
  productsLoading = this.productsService.loading;

  loading = false;
  paymentLoading = false;
  formSubmitted = false;
  shipping = this.shippingService.current; 
  shippingMethod = signal<ShippingMethod | null>('delivery');
  sameAsBuyer = signal(true);
  shippingFormSubmitted = false;

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

  toggleSameAsBuyer(): void {
    const sameAsBuyer = !this.sameAsBuyer();
    this.sameAsBuyer.set(sameAsBuyer);
    this.address.recipient_name = sameAsBuyer ? this.customer.nombre : '';
  }

  onBuyerNameChange(name: string): void {
    if (this.sameAsBuyer()) {
      this.address.recipient_name = name;
    }
  }

  ngOnInit(): void {
    this.productsService.getProducts().subscribe({
      error: error => console.error('Error al cargar otros productos:', error)
    });

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
    }
  
    const existing = this.shippingService.current();
    if (existing.method) this.shippingMethod.set(existing.method);
    if (existing.address) this.address = { ...existing.address };
  
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
      <h3 style="color: #2b5e2b; font-size: 15px; margin-bottom: 10px;">Dirección de envío</h3>
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
      </table>
    </div>
  `;
}

private generarSeccionPagoTransferencia(): string {
  return `
    <div style="margin-top: 25px;">
      <h3 style="color: #2b5e2b; font-size: 15px; margin-bottom: 10px;">Forma de pago — Transferencia bancaria</h3>
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
            <strong style="color: #2b5e2b;">BBVA</strong>
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
      <h2 style="color: #2b5e2b; text-align: center;">Detalle de Pedido</h2>
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

    if (this.sameAsBuyer() && this.shippingMethod() === 'delivery') {
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
      if (this.sameAsBuyer() && this.shippingMethod() === 'delivery') {
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

      this.cartService.clear();
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

    if (this.sameAsBuyer() && this.shippingMethod() === 'delivery') {
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
      if (this.sameAsBuyer() && this.shippingMethod() === 'delivery') {
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
    } catch (error) {
      console.error('Error al iniciar Mercado Pago:', error);
      this.router.navigate(['/orden/error']);
    } finally {
      this.paymentLoading = false;
    }
  }

  selectShippingMethod(method: ShippingMethod): void {
    this.shippingMethod.set(method);
    this.shippingService.setMethod(method);
  }

  get shippingValid(): boolean {
    if (this.shippingMethod() === 'pickup') return true;
    if (this.shippingMethod() === 'delivery') {
      const a = this.address;
      return !!(a.recipient_name && a.postal_code && a.street && a.street_number && a.province && a.locality);
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
