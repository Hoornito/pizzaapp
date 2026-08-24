import { prisma } from '@/lib/prisma';
import type { OrderStatus, PushPlatform } from '@prisma/client';
import { sendFcmNotification } from '@/lib/push/fcm';
import { sendWebPushNotification, type WebPushSubscription } from '@/lib/push/web-push';
import { isNativePushConfigured, isWebPushConfigured, type PushPayload } from '@/lib/push/config';

/**
 * Notificaciones push por cambio de estado del pedido.
 *
 * Dos caminos según el dispositivo:
 *  - App nativa (Android/iOS, envuelta con Capacitor) → FCM.
 *  - Navegador / PWA instalada → Web Push con VAPID.
 *
 * Si no hay credenciales cargadas no se manda nada y no se rompe nada: el aviso
 * por mail, WhatsApp y socket sigue igual.
 */

// ─── Alta y baja de dispositivos ─────────────────────────────────────────────

type RegisterInput = {
  userId?: string | null;
  platform: PushPlatform;
  /** Token de FCM (app nativa). */
  token?: string | null;
  /** Suscripción del navegador (Web Push). */
  subscription?: WebPushSubscription | null;
  userAgent?: string | null;
};

export async function registerPushDevice(input: RegisterInput) {
  const { userId, platform, token, subscription, userAgent } = input;

  if (platform === 'WEB') {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new Error('Suscripción de navegador incompleta');
    }
    // El endpoint identifica al navegador: si ya existía (misma PC, otra sesión)
    // se actualiza en vez de duplicarse.
    return prisma.pushDevice.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: userId ?? null,
        platform,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId: userId ?? null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        active: true,
        lastSeenAt: new Date(),
      },
    });
  }

  if (!token) throw new Error('Falta el token del dispositivo');

  return prisma.pushDevice.upsert({
    where: { token },
    create: { userId: userId ?? null, platform, token, userAgent: userAgent ?? null },
    update: { userId: userId ?? null, platform, active: true, lastSeenAt: new Date() },
  });
}

/** Baja explícita: el usuario apagó las notificaciones o cerró sesión. */
export async function unregisterPushDevice(where: { token?: string; endpoint?: string }) {
  if (!where.token && !where.endpoint) return;
  await prisma.pushDevice.deleteMany({
    where: where.token ? { token: where.token } : { endpoint: where.endpoint },
  });
}

async function deactivateDevice(id: string) {
  await prisma.pushDevice.update({ where: { id }, data: { active: false } }).catch(() => {});
}

// ─── Envío ───────────────────────────────────────────────────────────────────

/**
 * Manda la misma notificación a todos los dispositivos activos de un usuario.
 * Devuelve cuántos dispositivos tenía y a cuántos llegó.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ dispositivos: number; enviados: number }> {
  if (!isNativePushConfigured() && !isWebPushConfigured()) {
    return { dispositivos: 0, enviados: 0 };
  }

  // Sólo clientes: mostrador y admin no reciben avisos de pedidos. Se filtra acá
  // y no sólo al registrar, para que un dispositivo de staff que haya quedado de
  // antes tampoco reciba nada.
  const devices = await prisma.pushDevice.findMany({
    where: { userId, active: true, user: { is: { role: 'CUSTOMER' } } },
  });
  if (devices.length === 0) return { dispositivos: 0, enviados: 0 };

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      if (device.platform === 'WEB') {
        if (!device.endpoint || !device.p256dh || !device.auth) return false;
        const res = await sendWebPushNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload
        );
        if (!res.ok && res.gone) await deactivateDevice(device.id);
        return res.ok;
      }

      if (!device.token) return false;
      const res = await sendFcmNotification(device.token, payload);
      if (!res.ok && res.gone) await deactivateDevice(device.id);
      return res.ok;
    })
  );

  return {
    dispositivos: devices.length,
    enviados: results.filter((r) => r.status === 'fulfilled' && r.value).length,
  };
}

// ─── Textos por estado ───────────────────────────────────────────────────────

/**
 * Estados que le avisamos al cliente. Los que faltan (PENDIENTE_PAGO, RECIBIDO)
 * no se notifican: el cliente acaba de hacer el pedido y ya está mirando la
 * pantalla, mandarle un push ahí sólo molesta.
 */
const STATUS_PUSH: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  CONFIRMADO: {
    title: '✅ Pedido confirmado',
    body: 'Ya lo tomamos y va a la cocina.',
  },
  PREPARANDO: {
    title: '👨‍🍳 Preparando tu pedido',
    body: 'Estamos armando lo tuyo.',
  },
  EN_HORNO: {
    title: '🔥 Tu pedido está en el horno',
    body: 'Falta poco.',
  },
  LISTO: {
    title: '🎉 ¡Tu pedido está listo!',
    body: 'Ya sale del horno.',
  },
  EN_REPARTO: {
    title: '🛵 Tu pedido va en camino',
    body: 'El repartidor salió para tu dirección.',
  },
  ENTREGADO: {
    title: '🏠 Pedido entregado',
    body: '¡Buen provecho! Gracias por elegirnos.',
  },
  CANCELADO: {
    title: '❌ Pedido cancelado',
    body: 'Si no lo pediste vos, escribinos por WhatsApp.',
  },
};

type OrderForPush = {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  deliveryType?: string | null;
  estimatedTime?: number | null;
};

/**
 * Push de cambio de estado. Se llama best-effort desde el event bus: si algo
 * falla, el pedido ya se guardó igual.
 */
export async function sendOrderStatusPush(order: OrderForPush): Promise<void> {
  const base = STATUS_PUSH[order.status];
  if (!base || !order.userId) return;

  // Ajuste chico para retiro en el local: "va en camino" no aplica.
  let body = base.body;
  if (order.status === 'LISTO' && order.deliveryType === 'PICKUP') {
    body = 'Ya podés pasar a retirarlo por el local.';
  }
  if (order.status === 'CONFIRMADO' && order.estimatedTime) {
    body = `Ya lo tomamos. Estimado: ${order.estimatedTime} min.`;
  }

  const payload: PushPayload = {
    title: `${base.title} · #${order.orderNumber}`,
    body,
    url: '/orders',
    // Un pedido = un hilo: el aviso nuevo reemplaza al anterior en el celular.
    tag: `order-${order.id}`,
    data: { orderId: order.id, status: order.status },
  };

  const { dispositivos, enviados } = await sendPushToUser(order.userId, payload);

  // Historial del cliente, sólo para quien usa la app: si nunca registró un
  // dispositivo (pedido de mostrador, cliente que no activó los avisos) no tiene
  // sentido llenarle la tabla de filas que nadie va a leer.
  if (dispositivos === 0) return;

  await prisma.notification
    .create({
      data: {
        userId: order.userId,
        type: 'order:status',
        title: payload.title,
        body: payload.body,
        data: { orderId: order.id, status: order.status, pushDelivered: enviados },
      },
    })
    .catch(() => {});
}
