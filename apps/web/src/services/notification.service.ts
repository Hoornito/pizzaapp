import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from './email.service';
import { sendOrderConfirmationWA, sendOrderStatusUpdateWA } from './whatsapp.service';
import { eventBus } from '@/lib/event-bus';
import { sendOrderStatusPush } from './push.service';
import type { OrderWithRelations } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';

/**
 * ¿Corresponde avisar este estado? Devuelve false si es el mismo que ya se
 * notificó para ese pedido. Es el SEGUNDO cinturón: el primero es
 * `previousStatus` en el evento (un cambio real de estado). Éste tapa el caso
 * de dos procesos emitiendo la misma transición a la vez. Si Redis no responde,
 * avisamos igual: preferimos un mensaje repetido antes que un cliente sin
 * enterarse de que su pedido salió.
 */
const NOTIFIED_TTL_S = 24 * 60 * 60;
async function shouldNotifyStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  try {
    const key = `notif:order:${orderId}:status`;
    const last = await redis.get(key);
    if (last === status) return false;
    await redis.setex(key, NOTIFIED_TTL_S, status);
    return true;
  } catch {
    return true;
  }
}

function setupEventListeners() {
  eventBus.on('order:created', async (order: OrderWithRelations) => {
    const tasks = [sendOrderConfirmationEmail(order).catch(() => {})];

    // Los pedidos que entran por el chat ya reciben SU confirmación desde el
    // propio chat (takeReadyOrder), con el detalle y los datos de transferencia.
    // Sin esta guarda el cliente recibía dos "¡Pedido confirmado!" seguidos.
    const fromWhatsApp = order.source === 'WHATSAPP';
    if (!fromWhatsApp && (order.phone || order.user.phone)) {
      const phone = order.phone || order.user.phone!;
      tasks.push(
        sendOrderConfirmationWA(phone, order.orderNumber, Number(order.total)).catch(() => {})
      );
    }

    await Promise.allSettled(tasks);
  });

  eventBus.on('order:status_changed', async (order: OrderWithRelations, previousStatus: string | null) => {
    // Un cambio de estado se avisa UNA vez, y sólo si el estado cambió de verdad.
    // Cobrar el pedido, asignarle repartidor o guardarle el tiempo estimado
    // vuelven a guardar el pedido con el MISMO estado: sin esta guarda, cada una
    // de esas acciones le repetía al cliente el último aviso ("tu pedido está
    // listo" tres veces seguidas).
    if (previousStatus === order.status) return;
    if (!(await shouldNotifyStatus(order.id, order.status))) return;

    const tasks = [sendOrderStatusEmail(order, order.status).catch(() => {})];

    // Push al celular del cliente (app nativa o navegador). Best-effort: si no
    // hay dispositivos registrados o falta configuración, no hace nada.
    tasks.push(sendOrderStatusPush(order as never).catch(() => {}));

    // WhatsApp sólo para los estados que le importan al cliente (ver
    // WA_NOTIFIED_STATUSES): el resto son pasos internos de cocina.
    if (order.phone || order.user.phone) {
      const phone = order.phone || order.user.phone!;
      const driver = order.deliveryEmployee;
      tasks.push(
        sendOrderStatusUpdateWA(phone, order.orderNumber, order.status, {
          deliveryType: order.deliveryType,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : null,
        }).catch(() => {})
      );
    }

    await Promise.allSettled(tasks);
  });
}

// La marca va en globalThis y no en una variable de módulo: ahora que el bus se
// comparte entre los dos grafos de módulos, un módulo evaluado dos veces podría
// registrar los listeners por duplicado y mandar todo (mail, WhatsApp, push) dos
// veces por cada cambio de estado.
const globalForListeners = globalThis as unknown as { notificationListenersReady?: boolean };

export function initNotificationListeners() {
  if (globalForListeners.notificationListenersReady) return;
  globalForListeners.notificationListenersReady = true;
  setupEventListeners();
  console.log('[NotificationService] Event listeners registered');
}

export async function getNotifications(params?: {
  userId?: string;
  unreadOnly?: boolean;
  limit?: number;
}) {
  const { userId, unreadOnly, limit = 50 } = params || {};

  return prisma.notification.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllNotificationsRead(userId?: string): Promise<void> {
  await prisma.notification.updateMany({
    where: userId ? { userId } : {},
    data: { read: true },
  });
}
