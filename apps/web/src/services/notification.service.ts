import { prisma } from '@/lib/prisma';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from './email.service';
import { sendOrderConfirmationWA, sendOrderStatusUpdateWA } from './whatsapp.service';
import { eventBus } from '@/lib/event-bus';
import type { OrderWithRelations } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';

function setupEventListeners() {
  eventBus.on('order:created', async (order: OrderWithRelations) => {
    const tasks = [sendOrderConfirmationEmail(order).catch(() => {})];

    if (order.phone || order.user.phone) {
      const phone = order.phone || order.user.phone!;
      tasks.push(
        sendOrderConfirmationWA(phone, order.orderNumber, Number(order.total)).catch(() => {})
      );
    }

    await Promise.allSettled(tasks);
  });

  eventBus.on('order:status_changed', async (order: OrderWithRelations) => {
    const tasks = [sendOrderStatusEmail(order, order.status).catch(() => {})];

    if (order.phone || order.user.phone) {
      const phone = order.phone || order.user.phone!;
      tasks.push(
        sendOrderStatusUpdateWA(phone, order.orderNumber, order.status).catch(() => {})
      );
    }

    await Promise.allSettled(tasks);
  });
}

let listenersSetup = false;

export function initNotificationListeners() {
  if (listenersSetup) return;
  setupEventListeners();
  listenersSetup = true;
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
