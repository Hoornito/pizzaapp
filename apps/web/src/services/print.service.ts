import type { OrderWithRelations } from '@/types/order.types';
import { toNumber, formatDate, formatOrderPayment } from '@/lib/utils';

export function generateKitchenTicketHtml(order: OrderWithRelations): string {
  const items = order.items
    .map(
      (item) => `
    <tr>
      <td class="qty">${item.quantity}x</td>
      <td class="name">${item.product?.name || item.promotion?.name || 'Producto'}</td>
      <td class="price">$${toNumber(item.subtotal).toLocaleString('es-AR')}</td>
    </tr>
    ${item.notes ? `<tr><td></td><td colspan="2" class="notes">⚠️ ${item.notes}</td></tr>` : ''}`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Ticket #${order.orderNumber}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    width: 80mm;
    padding: 4mm;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 14px; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  .qty { width: 24px; font-weight: bold; }
  .name { width: auto; padding: 2px 4px; }
  .price { text-align: right; white-space: nowrap; }
  .notes { font-size: 11px; padding: 0 4px 4px; color: #333; }
  .totals td { padding: 2px 0; }
  .total-row { font-weight: bold; font-size: 14px; }
  @media print {
    .no-print { display: none !important; }
    body { print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="no-print" style="padding:8px;background:#f0f0f0;margin-bottom:8px;">
    <button onclick="window.print()" style="padding:8px 16px;cursor:pointer;">🖨️ Imprimir</button>
  </div>

  <h1>🍕 PIZZERÍA</h1>
  <div class="divider"></div>

  <div class="center">
    <div class="bold" style="font-size:15px;">PEDIDO #${order.orderNumber}</div>
    <div>${formatDate(order.createdAt)}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tr>
      <td><strong>Cliente:</strong></td>
      <td>${order.user.name || 'Sin nombre'}</td>
    </tr>
    ${order.phone || order.user.phone ? `<tr><td><strong>Teléfono:</strong></td><td>${order.phone || order.user.phone}</td></tr>` : ''}
    <tr>
      <td><strong>Tipo:</strong></td>
      <td>${order.deliveryType === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 RETIRO EN LOCAL'}</td>
    </tr>
    ${
      order.address
        ? `<tr>
      <td><strong>Dirección:</strong></td>
      <td>${order.address.street} ${order.address.number}${order.address.apartment ? ' ' + order.address.apartment : ''}<br>${order.address.city}</td>
    </tr>`
        : ''
    }
    ${order.address?.reference ? `<tr><td><strong>Ref:</strong></td><td>${order.address.reference}</td></tr>` : ''}
  </table>

  <div class="divider"></div>

  <strong>DETALLE:</strong>
  <table style="margin-top:4px;">
    ${items}
  </table>

  <div class="divider"></div>

  <table class="totals">
    <tr>
      <td>Subtotal:</td>
      <td style="text-align:right;">$${toNumber(order.subtotal).toLocaleString('es-AR')}</td>
    </tr>
    ${toNumber(order.deliveryFee) > 0 ? `<tr><td>Envío:</td><td style="text-align:right;">$${toNumber(order.deliveryFee).toLocaleString('es-AR')}</td></tr>` : ''}
    <tr class="total-row">
      <td>TOTAL:</td>
      <td style="text-align:right;">$${toNumber(order.total).toLocaleString('es-AR')}</td>
    </tr>
    <tr>
      <td>Pago:</td>
      <td style="text-align:right;">${formatOrderPayment(order)}</td>
    </tr>
  </table>

  ${order.notes ? `<div class="divider"></div><div><strong>OBSERVACIONES:</strong><br>${order.notes}</div>` : ''}

  <div class="divider"></div>
  <div class="center" style="font-size:10px;">Gracias por su pedido!</div>
</body>
</html>`;
}
