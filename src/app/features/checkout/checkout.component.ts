import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { SessionContextService } from '../../core/services/session-context.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
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
  imports: [CommonModule, FormsModule, RouterModule, CurrencyArsPipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  public readonly cartService = inject(CartService);
  public readonly session = inject(SessionContextService);
  public readonly pricingConfigService = inject(PricingConfigService);

  loading = false;
  formSubmitted = false;

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

  ngOnInit(): void {
    if (this.cartService.isEmpty()) {
      this.router.navigate(['/cart']);
    }
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
      const priceUsd = item.price_usd || 0;
      const subtotalItemUsd = item.subtotal_usd || (priceUsd * item.quantity);
      const unitsPerPack = item.units_per_pack || 1;

      html += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">
            <strong style="color: #2b5e2b;">${this.escapeHtml(item.product_name)}</strong><br>
            <span style="font-size: 0.7em; color: #666;">PackX${unitsPerPack}u.</span><br>
            <span style="font-size: 0.7em; color: #888;">SKU: ${this.escapeHtml(item.sku)}</span>
          </td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">USD$${priceUsd.toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">USD$${subtotalItemUsd.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>

        <div style="margin-top: 30px; text-align: right; border-top: 2px solid #eee; padding-top: 15px;">
          <div style="margin-bottom: 5px;">
            <span style="font-size: 14px; color: #666; font-weight: bold;">TOTAL USD</span>
            <span style="font-size: 22px; color: #28a745; font-weight: bold; margin-left: 10px;">USD $${order.total_usd.toFixed(2)}</span>
          </div>
          <div style="margin-bottom: 5px;">
            <span style="font-size: 14px; color: #666; font-weight: bold;">TOTAL ARS</span>
            <span style="font-size: 18px; color: #2b5e2b; font-weight: bold; margin-left: 10px;">$${this.fmtNumber(order.total_ars)}</span>
          </div>
          <div style="margin-bottom: 5px; color: #888; font-size: 13px;">
            Cotización aplicada: $${this.fmtNumber(order.exchange_rate)} ARS
          </div>
          <div style="color: #999; font-size: 11px; font-style: italic;">
            ${this.pricingConfigService.vatLabel()}
          </div>
        </div>
        
        <div style="margin-top: 40px; padding: 15px; background-color: #e9f7ef; border-radius: 4px; text-align: center;">
          <p style="margin: 0; color: #1e7e34; font-weight: bold;">A la brevedad nos pondremos en contacto para coordinar el pago y envío. ¡Gracias!</p>
        </div>
      </div>
    `;

    return html;
  }

  async confirmarPedido(isValid: boolean | null) {
    this.formSubmitted = true;

    if (!isValid || this.cartService.isEmpty()) {
      return;
    }

    this.loading = true;
    const c = this.customer;
    const cartItems = this.cartService.cartItems();

    try {
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

  fmtNumber(n: number) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);
  }
}
