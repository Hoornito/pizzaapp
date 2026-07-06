import { sendMail } from '@/lib/mailer';
import { orderConfirmationTemplate } from '@/lib/email-templates/order-confirmation';
import { orderStatusUpdateTemplate } from '@/lib/email-templates/order-status-update';
import { passwordResetTemplate } from '@/lib/email-templates/password-reset';
import type { OrderWithRelations } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';
import { toNumber, formatOrderPayment } from '@/lib/utils';

export async function sendOrderConfirmationEmail(order: OrderWithRelations): Promise<void> {
  if (!order.user.email) return;

  const html = orderConfirmationTemplate({
    orderNumber: order.orderNumber,
    customerName: order.user.name || 'Cliente',
    items: order.items.map((item) => ({
      name: item.product?.name || item.promotion?.name || 'Producto',
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      subtotal: toNumber(item.subtotal),
    })),
    subtotal: toNumber(order.subtotal),
    deliveryFee: toNumber(order.deliveryFee),
    total: toNumber(order.total),
    deliveryType: order.deliveryType,
    address: order.address
      ? `${order.address.street} ${order.address.number}${order.address.apartment ? ` ${order.address.apartment}` : ''}, ${order.address.city}`
      : undefined,
    paymentMethod: formatOrderPayment(order),
    estimatedTime: order.estimatedTime ?? undefined,
  });

  await sendMail({
    to: order.user.email,
    subject: `✅ Pedido #${order.orderNumber} confirmado - Pizzería`,
    html,
  });
}

export async function sendOrderStatusEmail(
  order: OrderWithRelations,
  status: OrderStatus
): Promise<void> {
  if (!order.user.email) return;

  const html = orderStatusUpdateTemplate({
    orderNumber: order.orderNumber,
    customerName: order.user.name || 'Cliente',
    status,
    estimatedTime: order.estimatedTime ?? undefined,
    trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`,
  });

  await sendMail({
    to: order.user.email,
    subject: `📦 Actualización de tu pedido #${order.orderNumber}`,
    html,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const html = passwordResetTemplate(resetUrl, name);
  await sendMail({
    to: email,
    subject: '🔑 Recuperar contraseña - Pizzería',
    html,
  });
}
