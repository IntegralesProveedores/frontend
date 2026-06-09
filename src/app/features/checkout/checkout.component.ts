import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { SessionContextService } from '../../core/services/session-context.service';
import { CurrencyArsPipe } from '../../shared/pipes/currency-ars.pipe';
import { environment } from '../../../environments/environment';
import emailjs from '@emailjs/browser';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyArsPipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // DEPENDENCIAS
  // ─────────────────────────────────────────────────────────────
  private readonly router = inject(Router);
  public readonly cartService = inject(CartService);
  public readonly session = inject(SessionContextService);

  // ─────────────────────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────────────────────
  loading = false;
  formSubmitted = false;

  /** Objeto local de datos del cliente vinculado mediante ngModel */
  customer = {
    nombre: '',
    email: '',
    cuit: '',
    codigoArea: '',
    celular: ''
  };

  constructor() {
    // Reactividad: si el usuario se loguea/cambia, inyectamos sus datos automáticamente
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

  // ─────────────────────────────────────────────────────────────
  // MANEJO DE FORMULARIO
  // ─────────────────────────────────────────────────────────────

  /** 
   * Formatea el CUIT en tiempo real: xx-xxxxxxxx-x 
   */
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

  /** 
   * Genera el payload HTML para el correo de EmailJS.
   * CUIDADO: Este flujo es temporal (FASE 3 lo reemplazará por backend).
   */
  private generarHTMLCorreo(): string {
    const items = this.cartService.cartItems();
    const c = this.customer;

    let html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2b5e2b; text-align: center;">Detalle de Pedido</h2>
        <hr style="border: 0; border-top: 1px solid #eee;">
        <p><strong>Cliente:</strong> ${c.nombre}</p>
        <p><strong>CUIT:</strong> ${c.cuit || 'No informado'}</p>
        <p><strong>Teléfono:</strong> (${c.codigoArea}) ${c.celular}</p>
        <p><strong>Email:</strong> ${c.email}</p>
        
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

    items.forEach(item => {
      const priceUsd = item.price_usd || 0;
      const subtotalItemUsd = priceUsd * item.quantity;
      const unitsPerPack = item.units_per_pack || 1;
      
      html += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">
            <strong style="color: #2b5e2b;">${item.productName}</strong><br>
            <span style="font-size: 0.7em; color: #666;">PackX${unitsPerPack}u.</span><br>
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
            <span style="font-size: 22px; color: #28a745; font-weight: bold; margin-left: 10px;">USD $${this.cartService.totalUsd().toFixed(2)}</span>
          </div>
          <div style="margin-bottom: 5px;">
            <span style="font-size: 14px; color: #666; font-weight: bold;">TOTAL ARS</span>
            <span style="font-size: 18px; color: #2b5e2b; font-weight: bold; margin-left: 10px;">$${this.fmtNumber(this.cartService.subtotalArs())}</span>
          </div>
          <div style="margin-bottom: 5px; color: #888; font-size: 13px;">
            Cotización aplicada: $${this.fmtNumber(this.cartService.dolarOficial())} ARS
          </div>
          <div style="color: #999; font-size: 11px; font-style: italic;">
            IVA no incluido
          </div>
        </div>
        
        <div style="margin-top: 40px; padding: 15px; background-color: #e9f7ef; border-radius: 4px; text-align: center;">
          <p style="margin: 0; color: #1e7e34; font-weight: bold;">A la brevedad nos pondremos en contacto para coordinar el pago y envío. ¡Gracias!</p>
        </div>
      </div>
    `;

    return html;
  }

  // ─────────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────────

  confirmarPedido(isValid: boolean | null) {
    this.formSubmitted = true;
    
    if (!isValid || this.cartService.isEmpty()) {
      return;
    }

    this.loading = true;
    const c = this.customer;
    const mensajeHTML = this.generarHTMLCorreo();

    const templateParams = {
      to_name: c.nombre,
      to_email: c.email,
      name: c.nombre,
      reply_to: c.email,
      email: c.email,
      telefono: `(${c.codigoArea}) ${c.celular}`,
      order_id: `ORD-${Date.now().toString().slice(-6)}`,
      mensaje_html: mensajeHTML
    };

    emailjs.send(
      environment.emailjs.serviceId,
      environment.emailjs.templateId,
      templateParams,
      environment.emailjs.publicKey
    )
    .then(() => {
      this.cartService.clear();
      this.router.navigate(['/orden/exito']);
    })
    .catch((error) => {
      console.error('Error EmailJS:', error);
      this.router.navigate(['/orden/error']);
    })
    .finally(() => {
      this.loading = false;
    });
  }

  fmtNumber(n: number) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n || 0);
  }
}
