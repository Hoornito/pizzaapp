import { sendText, sendInteractiveButtons, sendInteractiveList, markAsRead } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import jwt from 'jsonwebtoken';
import { WHATSAPP_TOKEN_REDIS_TTL } from '@/lib/constants';
import type { WAMessage, WAConversationState } from '@/types/whatsapp.types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function generatePurchaseToken(phone: string): Promise<string> {
  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '2h' });

  await redis.setex(`wa:token:${token}`, WHATSAPP_TOKEN_REDIS_TTL, phone);

  await prisma.whatsAppToken.create({
    data: {
      token,
      phone,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  return token;
}

export async function validatePurchaseToken(
  token: string
): Promise<{ phone: string } | null> {
  try {
    const cached = await redis.get(`wa:token:${token}`);
    if (cached) return { phone: cached };

    const dbToken = await prisma.whatsAppToken.findFirst({
      where: { token, used: false, expiresAt: { gt: new Date() } },
    });

    if (!dbToken) return null;
    return { phone: dbToken.phone };
  } catch {
    return null;
  }
}

export async function markTokenAsUsed(token: string): Promise<void> {
  await redis.del(`wa:token:${token}`);
  await prisma.whatsAppToken.updateMany({
    where: { token },
    data: { used: true },
  });
}

export async function processIncomingMessage(from: string, message: WAMessage): Promise<void> {
  try {
    await markAsRead(message.id);
  } catch {}

  const conversation = await getOrCreateConversation(from, message.from);
  const state = conversation.state as WAConversationState;
  const text =
    message.text?.body?.trim().toLowerCase() ||
    message.button?.payload?.toLowerCase() ||
    message.interactive?.button_reply?.id?.toLowerCase() ||
    message.interactive?.list_reply?.id?.toLowerCase() ||
    '';

  switch (state) {
    case 'MENU':
    case 'AWAITING_OPTION':
      await handleMenuState(from, text, message);
      break;
    default:
      await sendWelcomeMenu(from);
      await updateConversationState(from, 'AWAITING_OPTION');
  }
}

async function handleMenuState(from: string, text: string, _message: WAMessage): Promise<void> {
  if (text === '1' || text === 'ver promociones' || text === 'promotions') {
    await sendPromotionsInfo(from);
  } else if (text === '2' || text === 'realizar pedido' || text === 'order') {
    await sendOrderLink(from);
  } else if (text === '3' || text === 'consultar pedido' || text === 'check_order') {
    await sendText(
      from,
      '📦 *Consultar pedido*\n\nPor favor envianos tu número de pedido (ej: 20240601-0001)'
    );
    await updateConversationState(from, 'CHECKING_ORDER');
  } else {
    await sendWelcomeMenu(from);
    await updateConversationState(from, 'AWAITING_OPTION');
  }
}

async function sendWelcomeMenu(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🍕 *¡Bienvenido a Pizzería!*\n\nSomos la mejor pizzería de la ciudad. ¿Qué querés hacer?',
    [
      { id: 'promotions', title: '🎁 Ver Promociones' },
      { id: 'order', title: '🛒 Realizar Pedido' },
      { id: 'check_order', title: '📦 Consultar Pedido' },
    ]
  );
}

async function sendPromotionsInfo(to: string): Promise<void> {
  const promotions = await prisma.promotion.findMany({
    where: { available: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  if (promotions.length === 0) {
    await sendText(to, 'No tenemos promociones activas en este momento. ¡Volvé pronto! 🍕');
    return;
  }

  const list = promotions
    .map((p) => `• *${p.name}*: $${Number(p.promotionalPrice).toLocaleString('es-AR')}\n  ${p.description || ''}`)
    .join('\n\n');

  await sendText(to, `🎁 *Nuestras promociones:*\n\n${list}\n\n¡Pedí ahora y te llega calentito! 🔥`);
  await sendWelcomeMenu(to);
}

async function sendOrderLink(to: string): Promise<void> {
  const token = await generatePurchaseToken(to);
  const orderUrl = `${APP_URL}/pedido/${token}`;

  await sendText(
    to,
    `🛒 *¡A pedir!*\n\nHacé clic en el siguiente enlace para armar tu pedido:\n\n${orderUrl}\n\n_Este enlace es válido por 2 horas._`
  );

  await updateConversationState(to, 'ORDER_LINK_SENT');
}

async function getOrCreateConversation(phone: string, waId: string) {
  return prisma.whatsAppConversation.upsert({
    where: { phone },
    update: { updatedAt: new Date() },
    create: { phone, waId, state: 'MENU' },
  });
}

async function updateConversationState(phone: string, state: WAConversationState) {
  await prisma.whatsAppConversation.update({
    where: { phone },
    data: { state },
  });
}

export async function sendOrderConfirmationWA(
  phone: string,
  orderNumber: string,
  total: number
): Promise<void> {
  await sendText(
    phone,
    `✅ *¡Pedido confirmado!*\n\n*Número:* ${orderNumber}\n*Total:* $${total.toLocaleString('es-AR')}\n\nTe avisamos cuando esté listo. 🍕`
  );
}

export async function sendOrderStatusUpdateWA(
  phone: string,
  orderNumber: string,
  status: string
): Promise<void> {
  const statusMessages: Record<string, string> = {
    CONFIRMADO: '✅ Tu pedido fue *confirmado*',
    PREPARANDO: '👨‍🍳 Tu pedido está siendo *preparado*',
    EN_HORNO: '🔥 Tu pedido está en el *horno*',
    LISTO: '🎉 Tu pedido está *listo*',
    EN_REPARTO: '🛵 Tu pedido está *en camino*',
    ENTREGADO: '🏠 Tu pedido fue *entregado*. ¡Buen provecho!',
    CANCELADO: '❌ Tu pedido fue *cancelado*',
  };

  const message = statusMessages[status] || `Estado actualizado: ${status}`;
  await sendText(phone, `🍕 *Pedido #${orderNumber}*\n\n${message}`);
}
