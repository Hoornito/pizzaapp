import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendText } from '@/lib/whatsapp';
import { logMessage } from './whatsapp.service';
import {
  takeReadyOrder,
  takeAddonOrder,
  editReadyOrder,
  resumeAI,
  type WAFlow,
  type ReadyOrder,
  type EditItemInput,
} from './wa-order-flow.service';

/** Estado (color) de la caja del chat, derivado de context.flow. */
function flowOf(context: unknown): WAFlow | 'normal' {
  const f = (context as { flow?: WAFlow } | null)?.flow;
  return f === 'ready' || f === 'needs_human' ? f : 'normal';
}
function readyOrderOf(context: unknown): ReadyOrder | null {
  return (context as { readyOrder?: ReadyOrder } | null)?.readyOrder ?? null;
}
/** Si el pedido armado es un "agregado", devuelve el número del pedido original. */
function addonOfCtx(context: unknown): string | null {
  return (context as { addonOf?: string } | null)?.addonOf ?? null;
}
/** Motivo por el que la IA derivó a una persona (extra a cobrar, consulta, etc.). */
function humanReasonOf(context: unknown): string | null {
  return (context as { humanReason?: string } | null)?.humanReason ?? null;
}

/** Lista de conversaciones para el inbox (con el último mensaje como preview). */
export async function listConversations() {
  const convos = await prisma.whatsAppConversation.findMany({
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  return convos.map((c) => ({
    id: c.id,
    phone: c.phone,
    contactName: c.contactName,
    botPaused: c.botPaused,
    unread: c.unread,
    lastMessageAt: c.lastMessageAt,
    // 🟢 'ready' = pedido listo para tomar · 🔴 'needs_human' = atender a mano.
    flow: flowOf(c.context),
    addonOf: addonOfCtx(c.context),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].body, type: c.messages[0].type, direction: c.messages[0].direction }
      : null,
  }));
}

/** Hilo + estado + pedido armado (para la vista de la conversación). */
export async function getConversationView(conversationId: string) {
  const [messages, convo] = await Promise.all([
    prisma.whatsAppMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 300 }),
    prisma.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { context: true, botPaused: true } }),
  ]);
  return {
    messages,
    flow: flowOf(convo?.context),
    readyOrder: readyOrderOf(convo?.context),
    addonOf: addonOfCtx(convo?.context),
    humanReason: humanReasonOf(convo?.context),
    botPaused: !!convo?.botPaused,
  };
}

export async function markConversationRead(conversationId: string) {
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { unread: 0 } });
}

/**
 * Pausa/reanuda el bot. Al REANUDAR un chat que estaba en 🔴 (needs_human), la IA
 * retoma el pedido con todo el hilo (incluida la respuesta que diste a mano).
 */
export async function setBotPaused(conversationId: string, paused: boolean) {
  const before = await prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    select: { context: true },
  });
  const flowBefore = flowOf(before?.context);

  const convo = await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { botPaused: paused },
  });

  // Al reactivar la IA (desde cualquier pausa, no solo 🔴), retoma el pedido con
  // todo el hilo (incluida la respuesta que diste a mano). Si ya está armado
  // (🟢), no la molestamos: la persona lo toma.
  if (!paused && flowBefore !== 'ready') {
    await resumeAI(conversationId).catch((e) => console.error('[inbox] resumeAI:', e));
  }
  return convo;
}

/**
 * Renombra el contacto. Es el nombre que se ve en el inbox y el que viaja al
 * pedido cuando se lo toma; arranca con el nombre de perfil de WhatsApp y se
 * puede corregir a mano (mucha gente tiene apodos ahí). Vacío = vuelve a
 * mostrarse el teléfono.
 */
export async function renameContact(conversationId: string, name: string) {
  const clean = name.trim().slice(0, 80);
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { contactName: clean || null },
  });
}

/**
 * Borra el hilo y deja la conversación como recién estrenada: sin mensajes, sin
 * contexto (pedido armado, sesión, color) y con el bot activo.
 *
 * Es una herramienta de PRUEBA: sirve para ensayar pedidos distintos desde el
 * mismo teléfono sin que el bot arrastre lo anterior. Borra de verdad, no se
 * puede deshacer, y NO toca los pedidos ya tomados (esos viven en Order).
 */
export async function clearConversation(conversationId: string) {
  await prisma.whatsAppMessage.deleteMany({ where: { conversationId } });
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { context: Prisma.DbNull, botPaused: false, unread: 0, lastMessageAt: null, state: 'AI_ORDERING' },
  });
}

/** "Tomar pedido": crea el pedido armado y lo manda a Pedidos. */
export async function takeOrder(conversationId: string, userId: string) {
  const orderNumber = await takeReadyOrder(conversationId, userId);
  return { orderNumber };
}

/** "Tomar agregado": crea el pedido vinculado (#original-N) con lo nuevo. */
export async function takeAddon(conversationId: string, userId: string) {
  const orderNumber = await takeAddonOrder(conversationId, userId);
  return { orderNumber };
}

/** Edición manual del pedido armado (agregar/quitar ítems, precio del extra). */
export async function editOrder(conversationId: string, items: EditItemInput[]) {
  await editReadyOrder(conversationId, items);
  return getConversationView(conversationId);
}

/**
 * Responde a mano desde el panel: manda el texto por la API de WhatsApp y lo
 * guarda en el hilo. Si el envío falla, igual queda registrado como "failed".
 */
export async function replyToConversation(conversationId: string, text: string, userId?: string) {
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) throw new Error('Conversación no encontrada');

  let sendError: string | null = null;
  try {
    await sendText(convo.phone, text);
  } catch (e) {
    sendError = e instanceof Error ? e.message : 'Error al enviar';
  }

  await logMessage(conversationId, {
    direction: 'OUT',
    type: 'text',
    body: text,
    status: sendError ? 'failed' : 'sent',
    sentById: userId ?? null,
  });
  await markConversationRead(conversationId);
  return { sent: !sendError, error: sendError };
}
