import { ORDER_STATUS_LABELS } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';

interface OrderStatusUpdateData {
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  estimatedTime?: number;
  trackingUrl?: string;
}

export function orderStatusUpdateTemplate(data: OrderStatusUpdateData): string {
  const label = ORDER_STATUS_LABELS[data.status];

  const statusEmoji: Record<string, string> = {
    RECIBIDO: '📥',
    CONFIRMADO: '✅',
    PREPARANDO: '👨‍🍳',
    EN_HORNO: '🔥',
    LISTO: '🎉',
    EN_REPARTO: '🛵',
    ENTREGADO: '🏠',
    CANCELADO: '❌',
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Actualización de pedido #${data.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#C62828;padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">🍕 Actualización de tu pedido</h1>
    </div>

    <div style="padding:30px;text-align:center;">
      <p style="font-size:16px;color:#333;">Hola <strong>${data.customerName}</strong>,</p>

      <div style="background:#fff3e0;border-radius:12px;padding:30px;margin:20px 0;display:inline-block;width:100%;box-sizing:border-box;">
        <div style="font-size:48px;">${statusEmoji[data.status] || '📦'}</div>
        <h2 style="color:#C62828;margin:10px 0 5px;font-size:22px;">${label}</h2>
        <p style="color:#666;margin:0;">Pedido #${data.orderNumber}</p>
      </div>

      ${data.estimatedTime ? `<p style="color:#555;">Tiempo estimado de entrega: <strong>${data.estimatedTime} minutos</strong></p>` : ''}

      ${
        data.trackingUrl
          ? `<a href="${data.trackingUrl}" style="display:inline-block;background:#C62828;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">Ver estado del pedido</a>`
          : ''
      }
    </div>

    <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999;">
      <p style="margin:0;">© ${new Date().getFullYear()} Pizzería. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}
