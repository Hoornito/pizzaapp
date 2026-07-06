interface OrderConfirmationData {
  orderNumber: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'DELIVERY' | 'PICKUP';
  address?: string;
  paymentMethod: string;
  estimatedTime?: number;
}

export function orderConfirmationTemplate(data: OrderConfirmationData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toLocaleString('es-AR')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.subtotal.toLocaleString('es-AR')}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Pedido Confirmado - #${data.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#C62828;padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">🍕 ¡Pedido Confirmado!</h1>
      <p style="color:#ffcdd2;margin:8px 0 0;">Pedido #${data.orderNumber}</p>
    </div>

    <div style="padding:30px;">
      <p style="font-size:16px;color:#333;">Hola <strong>${data.customerName}</strong>,</p>
      <p style="color:#555;">Tu pedido ha sido recibido y estamos preparándolo con mucho cariño. 🍕</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:10px;text-align:left;font-size:13px;color:#666;">PRODUCTO</th>
            <th style="padding:10px;text-align:center;font-size:13px;color:#666;">CANT.</th>
            <th style="padding:10px;text-align:right;font-size:13px;color:#666;">PRECIO</th>
            <th style="padding:10px;text-align:right;font-size:13px;color:#666;">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:8px;text-align:right;color:#666;">Subtotal:</td>
            <td style="padding:8px;text-align:right;">$${data.subtotal.toLocaleString('es-AR')}</td>
          </tr>
          ${data.deliveryFee > 0 ? `<tr><td colspan="3" style="padding:8px;text-align:right;color:#666;">Envío:</td><td style="padding:8px;text-align:right;">$${data.deliveryFee.toLocaleString('es-AR')}</td></tr>` : ''}
          <tr style="background:#fff3e0;">
            <td colspan="3" style="padding:10px;text-align:right;font-weight:bold;font-size:16px;">TOTAL:</td>
            <td style="padding:10px;text-align:right;font-weight:bold;font-size:16px;color:#C62828;">$${data.total.toLocaleString('es-AR')}</td>
          </tr>
        </tfoot>
      </table>

      <div style="background:#f9f9f9;border-radius:6px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Tipo de entrega:</strong> ${data.deliveryType === 'DELIVERY' ? '🏠 Delivery' : '🏪 Retiro en local'}</p>
        ${data.address ? `<p style="margin:0 0 8px;"><strong>Dirección:</strong> ${data.address}</p>` : ''}
        <p style="margin:0 0 8px;"><strong>Forma de pago:</strong> ${data.paymentMethod}</p>
        ${data.estimatedTime ? `<p style="margin:0;"><strong>Tiempo estimado:</strong> ${data.estimatedTime} minutos</p>` : ''}
      </div>

      <p style="color:#555;font-size:14px;">Podés seguir el estado de tu pedido en tiempo real desde nuestra aplicación.</p>
    </div>

    <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999;">
      <p style="margin:0;">© ${new Date().getFullYear()} Pizzería. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}
