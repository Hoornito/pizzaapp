import { sendText, sendTemplate, markAsRead } from '@/lib/whatsapp';
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

// Meta reintenta la entrega de un webhook si tarda en recibir el 200 (y a veces
// manda el mismo mensaje dos veces igual). Sin esto, el mismo mensaje se procesa
// de nuevo y el cliente recibe la respuesta duplicada.
const DEDUP_TTL_S = 6 * 60 * 60;
async function alreadyProcessed(waMessageId: string): Promise<boolean> {
  try {
    // NX: solo escribe si no existía. Devuelve null si ya estaba.
    const first = await redis.set(`wa:msg:${waMessageId}`, '1', 'EX', DEDUP_TTL_S, 'NX');
    return first === null;
  } catch {
    // Sin Redis preferimos arriesgar un duplicado antes que perder el mensaje.
    return false;
  }
}

export async function processIncomingMessage(
  from: string,
  message: WAMessage,
  profileName?: string | null
): Promise<void> {
  if (await alreadyProcessed(message.id)) {
    console.log(`[WA] mensaje ${message.id} ya procesado, se ignora la reentrega`);
    return;
  }

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
  // Un audio que no se pudo transcribir NO se responde: queda en el inbox para
  // que lo escuche una persona. Preferimos eso antes que adivinar un pedido.
  const rawText = voiceText?.trim() || (message.type === 'text' ? message.text?.body?.trim() || '' : '');
  if (!rawText) return;

  // No contestamos ESTE mensaje: esperamos a que el cliente termine de escribir
  // y contestamos la tanda entera de una (ver wa-batch.service). Import dinámico
  // para evitar el ciclo de imports con wa-order-flow.
  const { scheduleAIReply } = await import('./wa-batch.service');
  await scheduleAIReply(conversation.id);
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

/**
 * Nombre e idioma de la plantilla de "pedido listo" para mostrador, aprobados
 * en el Administrador de WhatsApp de Meta. Sin esto configurado no hay forma
 * de escribirle primero a un teléfono que nunca abrió conversación con el bot.
 */
const ORDER_READY_TEMPLATE = process.env.WHATSAPP_TEMPLATE_ORDER_READY;
const ORDER_READY_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es_AR';

/**
 * Aviso de "pedido listo" a un teléfono cargado en mostrador. A diferencia de
 * `sendOrderStatusUpdateWA` (que le contesta a una conversación ya abierta),
 * este número nunca le escribió al bot, así que el primer mensaje tiene que
 * ser una plantilla aprobada (`sendTemplate`): un texto libre WhatsApp lo
 * rechaza. Sale UNA sola vez por pedido, al pasar a LISTO.
 */
export async function sendOrderReadyTemplateWA(phone: string, orderNumber: string): Promise<void> {
  if (!ORDER_READY_TEMPLATE) return; // sin plantilla configurada (ver WHATSAPP_TEMPLATE_ORDER_READY), no se manda nada
  await sendTemplate(phone, ORDER_READY_TEMPLATE, ORDER_READY_TEMPLATE_LANG, [orderNumber]);
}

/**
 * Estados que SÍ se le avisan al cliente por WhatsApp.
 *
 * A propósito es una lista corta: el cliente ya recibió la confirmación al
 * tomarse el pedido ("te avisamos cuando esté listo"), así que los pasos
 * internos de cocina (RECIBIDO, CONFIRMADO, PREPARANDO, EN_HORNO) no le dicen
 * nada nuevo y sólo llenan el chat. El mail y el push siguen recibiendo todos
 * los estados; esto acota únicamente WhatsApp.
 */
const WA_NOTIFIED_STATUSES = new Set(['LISTO', 'EN_REPARTO', 'CANCELADO']);

export function whatsappNotifiesStatus(status: string): boolean {
  return WA_NOTIFIED_STATUSES.has(status);
}

/**
 * Aviso de cambio de estado. Es un mensaje AUTOMÁTICO (por eso lleva emoji, a
 * diferencia de las respuestas del bot, que imitan al que atiende).
 *
 * Se manda UNA sola vez por transición: quien decide eso es notification.service
 * comparando el estado anterior con el nuevo. Acá sólo se arma el texto.
 */
export async function sendOrderStatusUpdateWA(
  phone: string,
  orderNumber: string,
  status: string,
  info?: { deliveryType?: string | null }
): Promise<void> {
  if (!whatsappNotifiesStatus(status)) return;

  let message: string;
  if (status === 'LISTO') {
    message =
      info?.deliveryType === 'PICKUP'
        ? `🍕 *Pedido #${orderNumber}*

Ya está listo, te esperamos por el local.`
        : `🍕 *Pedido #${orderNumber}*

Ya está listo, en un ratito sale para allá.`;
  } else if (status === 'EN_REPARTO') {
    // A propósito NO lleva el nombre del repartidor: es un dato interno del
    // local, no algo que el cliente necesite.
    message = `🛵 *Pedido #${orderNumber}*

El chico ya salió para allá, así están atentos.`;
  } else {
    message = `❌ *Pedido #${orderNumber}*

Quedó cancelado. Cualquier cosa escribinos por acá.`;
  }

  await sendText(phone, message);
}
