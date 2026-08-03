import { prisma } from '@/lib/prisma';
import { logMessage } from './whatsapp.service';
import { handleAIOrder } from './wa-order-flow.service';
import { getConversationView } from './whatsapp-inbox.service';

/**
 * Simulador local: inyecta un mensaje "de cliente" y corre el mismo flujo de IA
 * que un mensaje real de WhatsApp — sin necesidad de un número registrado. Las
 * respuestas del bot no salen a ningún lado (no hay número), pero quedan en el
 * hilo, así se ve todo el armado del pedido, verde/rojo y "Tomar pedido".
 */
export async function simulateCustomerMessage(phone: string, text: string) {
  const convo = await prisma.whatsAppConversation.upsert({
    where: { phone },
    update: {},
    create: {
      phone,
      waId: phone.replace(/\D/g, '') || 'sim',
      state: 'AI_ORDERING',
      contactName: 'Cliente de prueba',
    },
  });

  // Igual que el webhook real: primero se guarda el mensaje entrante.
  await logMessage(convo.id, { direction: 'IN', type: 'text', body: text });

  const fresh = await prisma.whatsAppConversation.findUnique({ where: { id: convo.id } });
  // Si está pausado (🔴 o "a mano"), la IA no responde — igual que en producción.
  if (fresh && !fresh.botPaused) {
    await handleAIOrder(
      { id: fresh.id, phone: fresh.phone, context: fresh.context },
      text,
      { skipStoreCheck: true }
    );
  }

  const view = await getConversationView(convo.id);
  return { id: convo.id, ...view };
}

/** Borra la conversación de prueba (arranca un pedido de cero). */
export async function resetSimConversation(phone: string) {
  await prisma.whatsAppConversation.deleteMany({ where: { phone } });
}
