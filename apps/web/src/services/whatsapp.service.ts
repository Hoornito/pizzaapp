import { sendText, markAsRead } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import jwt from 'jsonwebtoken';
import { WHATSAPP_TOKEN_REDIS_TTL } from '@/lib/constants';
import type { WAMessage } from '@/types/whatsapp.types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

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

/** Guarda un mensaje del hilo (para el inbox) y actualiza la conversación. */
export async function logMessage(
  conversationId: string,
  data: {
    direction: 'IN' | 'OUT';
    type?: string;
    body?: string | null;
    mediaUrl?: string | null;
    mediaMime?: string | null;
    waMessageId?: string | null;
    status?: string | null;
    sentById?: string | null;
  }
) {
  await prisma.whatsAppMessage.create({
    data: {
      conversationId,
      direction: data.direction,
      type: data.type ?? 'text',
      body: data.body ?? null,
      mediaUrl: data.mediaUrl ?? null,
      mediaMime: data.mediaMime ?? null,
      waMessageId: data.waMessageId ?? null,
      status: data.status ?? null,
      sentById: data.sentById ?? null,
    },
  });
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(data.direction === 'IN' ? { unread: { increment: 1 } } : {}),
    },
  });
}

export async function processIncomingMessage(
  from: string,
  message: WAMessage,
  profileName?: string | null
): Promise<void> {
  try {
    await markAsRead(message.id);
  } catch {}

  const conversation = await getOrCreateConversation(from, message.from, profileName);

  // Notas de voz: las transcribimos y seguimos como si el cliente hubiera
  // escrito. Va antes del logMessage para que en el inbox quede el texto y no
  // un "audio" mudo: el que atiende lee en vez de tener que escuchar.
  let voiceText: string | null = null;
  if (message.type === 'audio' && message.audio?.id) {
    const { transcribeVoiceNote } = await import('./wa-transcribe.service');
    voiceText = await transcribeVoiceNote(message.audio.id);
  }

  // Guardamos el mensaje entrante en el hilo (para verlo en el inbox del panel).
  await logMessage(conversation.id, {
    direction: 'IN',
    type: message.type,
    body: voiceText
      ? `🎤 ${voiceText}`
      : message.type === 'audio'
        ? '🎤 (audio que no se pudo transcribir)'
        : (message.text?.body ?? message.button?.text ?? null),
    waMessageId: message.id,
  });

  // Takeover humano: si la conversación está "atendida a mano", el bot no responde.
  if (conversation.botPaused) return;

  // Toda respuesta automática sale del bot con SUS instrucciones (las de la base,
  // editables desde /admin/whatsapp/bot). No hay menús ni textos fijos acá: si el
  // bot no puede contestar, no contestamos nada y el mensaje queda en el inbox
  // para que lo tome una persona.
  //
  // Import dinámico para evitar el ciclo de imports con wa-order-flow.
  // Un audio que no se pudo transcribir NO se responde: queda en el inbox para
  // que lo escuche una persona. Preferimos eso antes que adivinar un pedido.
  const rawText = voiceText?.trim() || (message.type === 'text' ? message.text?.body?.trim() || '' : '');
  if (!rawText) return;

  const { handleAIOrder } = await import('./wa-order-flow.service');
  await handleAIOrder(
    { id: conversation.id, phone: conversation.phone, context: conversation.context },
    rawText
  );
}

async function getOrCreateConversation(phone: string, waId: string, profileName?: string | null) {
  const name = profileName?.trim() || null;
  const convo = await prisma.whatsAppConversation.upsert({
    where: { phone },
    update: { updatedAt: new Date() },
    create: { phone, waId, state: 'AI_ORDERING', contactName: name },
  });

  // Sólo completamos el nombre si todavía no hay ninguno. Si el local lo editó
  // a mano, el perfil de WhatsApp no vuelve a pisarlo en el próximo mensaje.
  if (name && !convo.contactName) {
    return prisma.whatsAppConversation.update({
      where: { id: convo.id },
      data: { contactName: name },
    });
  }
  return convo;
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
