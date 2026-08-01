import { prisma } from '@/lib/prisma';
import { sendText } from '@/lib/whatsapp';
import { logMessage } from './whatsapp.service';

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
    lastMessage: c.messages[0]
      ? { body: c.messages[0].body, type: c.messages[0].type, direction: c.messages[0].direction }
      : null,
  }));
}

export async function getConversationMessages(conversationId: string) {
  return prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 300,
  });
}

export async function markConversationRead(conversationId: string) {
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { unread: 0 } });
}

export async function setBotPaused(conversationId: string, paused: boolean) {
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { botPaused: paused },
  });
}

/**
 * Responde a mano desde el panel: manda el texto por la API de WhatsApp y lo
 * guarda en el hilo. Si el envío falla (p. ej. sin número/token configurado),
 * igual queda registrado como "failed" para no perder lo escrito.
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
