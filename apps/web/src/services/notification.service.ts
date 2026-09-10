import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from './email.service';
import { sendOrderReadyTemplateWA, sendOrderStatusUpdateWA } from './whatsapp.service';
import { eventBus } from '@/lib/event-bus';
import { sendOrderStatusPush, sendPaymentReceivedPush } from './push.service';
import { isWebOrder, isWhatsAppOrder } from '@/lib/utils';
import type { OrderWithRelations } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';

/** Un aviso que falla no debe tirar abajo el resto (mail, push); pero antes se
 * tragaba el error entero y no quedaba rastro de por qué no llegó. */
function logNotifyError(canal: string, orderNumber: string, err: unknown) {
  console.error(`[notify] ${canal} pedido #${orderNumber}:`, err);
}

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

/**
 * ¿Este cambio de estado tiene sentido avisárselo al cliente? Vale para TODOS
 * los canales (mail, push y WhatsApp): si el aviso no le sirve, no le sirve por
 * ninguno.
 *
 * El único caso hoy es ENTREGADO en un pedido que sale con reparto. Ese estado
 * no se marca cuando el cliente recibe la pizza, sino cuando el repartidor
 * vuelve al local con la plata —puede ser una hora después—, así que un "tu
 * pedido fue entregado" a esa altura le llega a alguien que ya comió y sólo
 * confunde. En el retiro por el local sí es fiel: se marca al entregarlo en el
 * mostrador, con el cliente enfrente.
 */
function leInteresaAlCliente(order: OrderWithRelations): boolean {
  if (order.status !== 'ENTREGADO') return true;
  return order.deliveryType === 'PICKUP';
}

function setupEventListeners() {
  eventBus.on('order:created', async (order: OrderWithRelations) => {
    const tasks = [sendOrderConfirmationEmail(order).catch(() => {})];

    // Un pedido = un canal. Los que entran por el chat ya reciben SU
    // confirmación desde el propio chat (takeReadyOrder). Los de la web la
    // tienen en pantalla. Mostrador NO recibe WhatsApp acá: ese teléfono nunca
    // le escribió al bot, así que un texto libre lo rechaza Meta (hace falta
    // plantilla), y el único WhatsApp que vale la pena pagar en mostrador es
    // el aviso de "listo" (ver 'order:status_changed').
    await Promise.allSettled(tasks);
  });

  /**
   * Pago confirmado. Sólo avisa por PUSH (no mail ni WhatsApp) y sólo en pedidos
   * de TRANSFERENCIA: es el único caso donde el cliente ya mandó la plata y se
   * queda esperando a que alguien del local le diga que entró. En efectivo no
   * hay nada que confirmar, y Mercado Pago ya le avisa por su cuenta.
   *
   * Se dispara cuando el local toca "Pagó" en el panel (markOrderPaid).
   */
  eventBus.on('order:paid', async (order: OrderWithRelations) => {
    if (order.paymentMethod !== 'TRANSFERENCIA') return;
    if (!order.userId) return;
    await sendPaymentReceivedPush({
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
    }).catch(() => {});
  });

  eventBus.on('order:status_changed', async (order: OrderWithRelations, previousStatus: string | null) => {
    // Un cambio de estado se avisa UNA vez, y sólo si el estado cambió de verdad.
    // Cobrar el pedido, asignarle repartidor o guardarle el tiempo estimado
    // vuelven a guardar el pedido con el MISMO estado: sin esta guarda, cada una
    // de esas acciones le repetía al cliente el último aviso ("tu pedido está
    // listo" tres veces seguidas).
    if (previousStatus === order.status) return;
    if (!leInteresaAlCliente(order)) return;
    if (!(await shouldNotifyStatus(order.id, order.status))) return;

    const tasks = [sendOrderStatusEmail(order, order.status).catch((e) => logNotifyError('email', order.orderNumber, e))];

    // Un pedido = un canal, el mismo por el que entró: si lo pidió por la web
    // se avisa por push (la app que ya está usando); si vino por WhatsApp o lo
    // cargó el local a mano, por WhatsApp. Nunca los dos, para no repetir el
    // mismo aviso en dos lugares distintos.
    if (isWebOrder(order)) {
      // Best-effort: si no hay dispositivos registrados o falta configuración,
      // no hace nada.
      tasks.push(sendOrderStatusPush(order as never).catch((e) => logNotifyError('push', order.orderNumber, e)));
    } else if (order.phone || order.user?.phone) {
      const phone = order.phone || order.user!.phone!;
      if (isWhatsAppOrder(order)) {
        // Ya viene charlando con el bot: la conversación está abierta, un
        // texto libre le llega sin problema. WhatsApp sólo para los estados
        // que le importan al cliente (ver WA_NOTIFIED_STATUSES).
        tasks.push(
          sendOrderStatusUpdateWA(phone, order.orderNumber, order.status, {
            deliveryType: order.deliveryType,
          }).catch((e) => logNotifyError('whatsapp-status', order.orderNumber, e))
        );
      } else if (order.status === 'LISTO') {
        // Mostrador: este teléfono nunca le escribió al bot, así que el único
        // mensaje posible es la plantilla aprobada (ver sendOrderReadyTemplateWA).
        // Un solo aviso por pedido, cuando está listo.
        tasks.push(
          sendOrderReadyTemplateWA(phone, order.orderNumber).catch((e) => logNotifyError('whatsapp-template', order.orderNumber, e))
        );
      }
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
