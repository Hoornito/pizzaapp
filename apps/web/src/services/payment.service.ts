import { mpPreference, mpPayment } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/event-bus';
import { promoteOrderAfterPayment } from '@/services/order.service';
import type { OrderWithRelations } from '@/types/order.types';

export async function createMercadoPagoPreference(order: OrderWithRelations) {
  const items = order.items.map((item) => ({
    id: item.productId || item.promotionId || item.id,
    title: item.product?.name || item.promotion?.name || 'Producto',
    quantity: item.quantity,
    unit_price: Number(item.unitPrice),
    currency_id: 'ARS',
  }));

  if (Number(order.deliveryFee) > 0) {
    items.push({
      id: 'delivery',
      title: 'Envío',
      quantity: 1,
      unit_price: Number(order.deliveryFee),
      currency_id: 'ARS',
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // MercadoPago rechaza auto_return con back_urls en localhost (HTTP 400),
  // así que solo lo activamos cuando la app corre en un dominio público https.
  const isPublicHttps = /^https:\/\//.test(appUrl) && !appUrl.includes('localhost');

  const pref = await mpPreference.create({
    body: {
      items,
      payer: {
        name: order.user.name || '',
        email: order.user.email || undefined,
        phone: order.phone
          ? { area_code: '', number: order.phone.replace(/\D/g, '') }
          : undefined,
      },
      external_reference: order.id,
      // Solo tarjeta y dinero en cuenta: excluimos efectivo (Rapipago/Pago Fácil
      // = ticket) y cajeros (atm).
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
      },
      back_urls: {
        success: `${appUrl}/orders/${order.id}?payment=success`,
        failure: `${appUrl}/orders/${order.id}?payment=failure`,
        pending: `${appUrl}/orders/${order.id}?payment=pending`,
      },
      ...(isPublicHttps ? { auto_return: 'approved' as const } : {}),
      notification_url: `${appUrl}/api/payments/webhook`,
      statement_descriptor: 'PIZZERIA',
    },
  });

  await prisma.payment.update({
    where: { orderId: order.id },
    data: {
      mpPreferenceId: pref.id,
      mpExternalReference: order.id,
    },
  });

  return pref;
}

const SYNC_ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  address: true,
  items: { include: { product: true, promotion: true } },
  payment: true,
} as const;

/**
 * Consulta a MercadoPago el estado real del pago de un pedido (por
 * external_reference) y actualiza el Payment/Order. Sirve para confirmar pagos
 * cuando el webhook no llega (ej. en localhost), al volver del checkout.
 */
export async function syncMercadoPagoPayment(orderId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  if (!token) return { status: 'unknown' as const, found: false };

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const results = json.results ?? [];
  if (results.length === 0) return { status: 'pending' as const, found: false };

  // Preferimos el pago aprobado; si no hay, el más reciente.
  const approved = results.find((p) => p.status === 'approved');
  const latest = approved ?? results[0];
  const mpStatus = String(latest.status);

  const status: 'APPROVED' | 'PENDING' | 'REJECTED' =
    mpStatus === 'approved'
      ? 'APPROVED'
      : mpStatus === 'pending' || mpStatus === 'in_process'
        ? 'PENDING'
        : 'REJECTED';

  await prisma.payment.update({
    where: { orderId },
    data: {
      mpPaymentId: String(latest.id),
      mpStatus,
      mpStatusDetail: (latest.status_detail as string) ?? null,
      status,
      paidAt: mpStatus === 'approved' ? new Date() : undefined,
    },
  });

  if (mpStatus === 'approved') {
    // Promueve el pedido de PENDIENTE_PAGO a RECIBIDO y avisa a la cocina.
    await promoteOrderAfterPayment(orderId);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: SYNC_ORDER_INCLUDE });
    if (order) eventBus.emit('order:paid', order as never);
  }

  return { status, found: true };
}

export async function processMercadoPagoWebhook(paymentId: string) {
  const paymentData = await mpPayment.get({ id: Number(paymentId) });

  if (!paymentData.external_reference) return null;

  const orderId = paymentData.external_reference;

  const mpStatus = paymentData.status || 'unknown';
  const paymentStatus =
    mpStatus === 'approved' ? 'APPROVED' : mpStatus === 'pending' ? 'PENDING' : 'REJECTED';

  const payment = await prisma.payment.update({
    where: { orderId },
    data: {
      mpPaymentId: String(paymentId),
      mpStatus,
      mpStatusDetail: paymentData.status_detail || null,
      status: paymentStatus as 'APPROVED' | 'PENDING' | 'REJECTED',
      paidAt: mpStatus === 'approved' ? new Date() : undefined,
    },
    include: {
      order: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          address: true,
          items: { include: { product: true, promotion: true } },
          payment: true,
        },
      },
    },
  });

  if (mpStatus === 'approved') {
    // Promueve PENDIENTE_PAGO -> RECIBIDO y avisa a la cocina (idempotente).
    await promoteOrderAfterPayment(orderId);
    eventBus.emit('order:paid', payment.order as never);
  }

  return payment;
}
