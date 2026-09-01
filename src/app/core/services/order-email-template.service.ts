import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ShippingAddress, ShippingMethod } from '../models/order.model';
import { ApiService, PaymentTransferInfo } from './api.service';

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
  payment_method?: 'mercadopago' | 'transferencia';
  payment_commission_percentage?: number;
  payment_commission_amount?: number;
};

type OrderEmailCustomer = {
  nombre: string;
  email: string;
  cuit: string;
  codigoArea: string;
  celular: string;
};

type OrderEmailBox = {
  boxModelName: string;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  weightKg: number;
  count: number;
};

@Injectable({ providedIn: 'root' })
export class OrderEmailTemplateService {
  private readonly api = inject(ApiService);

  async generarHTMLCorreo(
    order: ValidatedOrder,
    customer: OrderEmailCustomer,
    shippingMethod: ShippingMethod,
    shippingAddress: ShippingAddress | null,
    shippingCost: number | null,
    boxes: OrderEmailBox[] | undefined,
    paymentMethod: 'mercadopago' | 'transferencia' | null,
    volumeDiscountPercentage: number,
    subtotalSinDescuento: number,
    vatLabel: string,
  ): Promise<string> {
    const c = customer;
    const seccionPago = await this.generarSeccionPago(order, paymentMethod);
    return `<div style="font-family:Arial,sans-serif;color:#333;max-width:700px;margin:auto;border:1px solid #eee;padding:20px;"><h2 style="color:#2b5e2b;text-align:center;">DETALLE DEL PEDIDO</h2><hr style="border:0;border-top:1px solid #eee;"><p><strong>Cliente:</strong> ${this.escapeHtml(c.nombre)}</p><p><strong>CUIT:</strong> ${this.escapeHtml(c.cuit) || 'No informado'}</p><p><strong>Teléfono:</strong> (${this.escapeHtml(c.codigoArea)}) ${this.escapeHtml(c.celular)}</p><p><strong>Email:</strong> ${this.escapeHtml(c.email)}</p>${this.generarSeccionProductos(order)}${this.generarSeccionEmbalaje(boxes)}${this.generarSeccionEnvio(shippingMethod, shippingAddress, shippingCost)}${seccionPago}${this.generarSeccionTotales(order, volumeDiscountPercentage, subtotalSinDescuento, vatLabel)}<div style="margin-top:20px;padding:15px;background-color:#f8f9fa;border-radius:4px;text-align:center;"><p style="margin:0;color:#2b5e2b;font-weight:bold;">¡Gracias por tu compra!</p></div></div>`;
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

  private generarSeccionEnvio(
    shippingMethod: ShippingMethod,
    shippingAddress: ShippingAddress | null,
    shippingCost: number | null,
  ): string {
    if (shippingMethod === 'coordinar') {
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

    if (shippingMethod === 'pickup') {
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

    const a = shippingAddress!;
    const direccionCompleta = [
      `${this.escapeHtml(a.street)} ${this.escapeHtml(a.street_number)}`,
      a.floor ? `Piso ${this.escapeHtml(a.floor)}` : null,
      a.apartment ? `Depto ${this.escapeHtml(a.apartment)}` : null,
    ]
      .filter(Boolean)
      .join(', ');

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
          <td style="padding: 4px 0; color: #333;">$${this.fmtNumber(shippingCost ?? 0)}</td>
        </tr>
      </table>
    </div>
  `;
  }

  private async generarSeccionPagoTransferencia(): Promise<string> {
    const cuentas = await firstValueFrom(this.api.getPaymentTransferInfo());
    const tablas = cuentas
      .map(
        (c: PaymentTransferInfo, index: number) => `
      <table width="100%" style="border-collapse: collapse; font-size: 13px;${index < cuentas.length - 1 ? ' margin-bottom: 12px;' : ''}">
        <tr>
          <td style="padding: 10px; background-color: #f8f9fa; border: 1px solid #eee;" colspan="2">
            <strong style="color: #2b5e2b;">${this.escapeHtml(c.bank_name)}</strong>
          </td>
        </tr>
        <tr><td style="padding: 4px 10px; color: #666;">Alias:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.alias)}</td></tr>
        ${c.cvu ? `<tr><td style="padding: 4px 10px; color: #666;">CVU:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.cvu)}</td></tr>` : ''}
        ${c.cbu ? `<tr><td style="padding: 4px 10px; color: #666;">CBU:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.cbu)}</td></tr>` : ''}
        <tr><td style="padding: 4px 10px; color: #666;">Titular:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.account_holder_name)}</td></tr>
        <tr><td style="padding: 4px 10px; color: #666;">CUIT:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.account_holder_tax_id)}</td></tr>
        ${c.account_number ? `<tr><td style="padding: 4px 10px; color: #666;">Cuenta:</td><td style="padding: 4px 10px;">${this.escapeHtml(c.account_number)}</td></tr>` : ''}
      </table>
  `,
      )
      .join('');

    return `
    <div style="margin-top: 25px;">
      <h3 style="color: #2b5e2b; font-size: 15px; margin-bottom: 10px;">FORMA DE PAGO: TRANSFERENCIA</h3>
      ${tablas}
      <div style="margin-top: 15px; padding: 15px; background-color: #e9f7ef; border-radius: 4px; text-align: center;">
        <p style="margin: 0; color: #1e7e34; font-weight: bold; font-size: 13px;">
          Recibido o acreditado el pago se procesa el pedido. El comprobante
          podés enviarlo por WhatsApp al +54 9 11 3022-6565.
        </p>
      </div>
    </div>
  `;
  }

  private generarSeccionProductos(order: ValidatedOrder): string {
    const groups = new Map<
      string,
      { name: string; totalUnits: number; subtotal: number; skus: string[] }
    >();
    for (const item of order.items) {
      const existing = groups.get(item.product_name);
      const units = (item.units_per_pack || 1) * item.quantity;
      const subtotal = item.subtotal_ars || item.price_ars * item.quantity;
      if (existing) {
        existing.totalUnits += units;
        existing.subtotal += subtotal;
        existing.skus.push(item.sku);
      } else
        groups.set(item.product_name, {
          name: item.product_name,
          totalUnits: units,
          subtotal,
          skus: [item.sku],
        });
    }
    let rows = '';
    groups.forEach(
      (g) =>
        (rows += `<tr><td style="border:1px solid #ddd;padding:10px;"><strong style="color:#2b5e2b;">${this.escapeHtml(g.name)}</strong><br><span style="font-size:.7em;color:#888;">SKU: ${this.escapeHtml(g.skus.join(', '))}</span></td><td style="border:1px solid #ddd;padding:10px;text-align:center;">${g.totalUnits} u.</td><td style="border:1px solid #ddd;padding:10px;text-align:right;">$${this.fmtNumber(g.subtotal)}</td></tr>`),
    );
    return `<h3 style="color:#2b5e2b;font-size:15px;margin:25px 0 10px;">PRODUCTOS</h3><table width="100%" style="border-collapse:collapse;font-size:13px;"><thead><tr style="background-color:#f8f9fa;"><th style="border:1px solid #ddd;padding:10px;text-align:left;">Producto</th><th style="border:1px solid #ddd;padding:10px;text-align:center;">Unidades</th><th style="border:1px solid #ddd;padding:10px;text-align:right;">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private generarSeccionEmbalaje(
    boxesInput: OrderEmailBox[] | undefined,
  ): string {
    const boxes = boxesInput ?? [];
    if (!boxes.length) return '';
    const rows = boxes
      .map(
        (b) =>
          `<tr><td style="padding:4px 0;color:#666;">${b.count} x ${this.escapeHtml(b.boxModelName)}</td><td style="padding:4px 0;color:#333;text-align:right;">${b.widthCm} x ${b.lengthCm} x ${b.heightCm} x cm.</td></tr>`,
      )
      .join('');
    return `<h3 style="color:#2b5e2b;font-size:15px;margin:25px 0 10px;">EMBALAJE</h3><table width="100%" style="border-collapse:collapse;font-size:13px;">${rows}</table>`;
  }

  private async generarSeccionPago(
    order: ValidatedOrder,
    paymentMethod: 'mercadopago' | 'transferencia' | null,
  ): Promise<string> {
    if (
      order.payment_method === 'transferencia' ||
      paymentMethod === 'transferencia'
    )
      return this.generarSeccionPagoTransferencia();
    return `<h3 style="color:#2b5e2b;font-size:15px;margin:25px 0 10px;">PAGO</h3><p style="font-size:13px;color:#444;">Mercado Pago - Checkout Pro</p>`;
  }

  private generarSeccionTotales(
    order: ValidatedOrder,
    volumeDiscountPercentage: number,
    subtotalSinDescuento: number,
    vatLabel: string,
  ): string {
    const descuentoPct = volumeDiscountPercentage;
    const subtotal = subtotalSinDescuento;
    return `<h3 style="color:#2b5e2b;font-size:15px;margin:25px 0 10px;">TOTALES</h3><table width="100%" style="border-collapse:collapse;font-size:13px;"><tr><td>Subtotal</td><td style="text-align:right;">$${this.fmtNumber(subtotal)}</td></tr>${descuentoPct > 0 ? `<tr><td>Descuento</td><td style="text-align:right;color:#1e7e34;">${descuentoPct}% OFF</td></tr>` : ''}${order.shipping_ars > 0 ? `<tr><td>Envío</td><td style="text-align:right;">$${this.fmtNumber(order.shipping_ars)}</td></tr>` : ''}${order.payment_method === 'transferencia' && (order.payment_commission_percentage ?? 0) > 0 ? `<tr><td>Transferencia</td><td style="text-align:right;color:#1e7e34;">${order.payment_commission_percentage}% OFF</td></tr>` : ''}${order.payment_method === 'mercadopago' && (order.payment_commission_amount ?? 0) > 0 ? `<tr><td>Comisión de pago (Mercado Pago)</td><td style="text-align:right;">$${this.fmtNumber(order.payment_commission_amount ?? 0)}</td></tr>` : ''}<tr><td style="font-weight:bold;font-size:16px;padding-top:10px;">TOTAL</td><td style="font-weight:bold;font-size:20px;text-align:right;padding-top:10px;">$${this.fmtNumber(order.total_ars)}</td></tr></table><div style="color:#999;font-size:11px;font-style:italic;text-align:right;margin-top:4px;">${vatLabel}</div>`;
  }

  private fmtNumber(n: number) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);
  }
}
