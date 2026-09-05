import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

/**
 * Agrupa los mensajes seguidos de un mismo cliente en UNA sola llamada a la IA.
 *
 * Casi nadie manda el pedido en un mensaje: llega "hola", después el pedido,
 * después la dirección y después "abono por transferencia". Respondiendo a cada
 * uno se pagaban 4 llamadas al modelo —cada una con TODO el historial adentro—
 * para armar el mismo pedido, y el cliente recibía 4 respuestas cortadas que no
 * se parecen en nada a cómo contesta una persona.
 *
 * En vez de responder al mensaje, esperamos a que el cliente TERMINE de escribir:
 * cada mensaje reinicia una espera corta y sólo el último de la tanda dispara la
 * respuesta. El historial ya está en la base (lo guarda el webhook antes de
 * llamarnos), así que la IA ve los cuatro mensajes juntos y contesta una vez.
 *
 * La coordinación va por Redis (un contador por conversación) y no por una
 * variable en memoria: así sigue funcionando si mañana hay más de un proceso
 * atendiendo el webhook. Si Redis no responde, contestamos al mensaje como
 * antes: peor es no contestar.
 */

function envMs(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Silencio que esperamos desde el último mensaje antes de contestar. Ajustado a
 * cómo escribe la gente en los chats reales: los mensajes de una misma tanda
 * llegan con 10-40 s entre el primero y el último, pero de a ráfagas de pocos
 * segundos. 10 s corta la ráfaga sin que la respuesta se sienta lenta —con 7 s
 * se colaban tandas partidas al medio ("cuanto me sale?" contestado aparte de
 * "te puedo pagar con transfe?", con la misma pregunta repetida en las dos).
 */
const QUIET_MS = envMs(process.env.WA_BATCH_QUIET_MS, 10_000);
/** Tope duro: por más que siga escribiendo, a los 25 s le contestamos. */
const MAX_WAIT_MS = envMs(process.env.WA_BATCH_MAX_MS, 25_000);
const KEY_TTL_S = 120;
/** Cuánto esperamos a que termine una respuesta en curso antes de largar la nuestra. */
const LOCK_TTL_S = 90;
const LOCK_WAIT_MS = 30_000;
const LOCK_POLL_MS = 1_000;

const seqKey = (id: string) => `wa:batch:seq:${id}`;
const sinceKey = (id: string) => `wa:batch:since:${id}`;
const lockKey = (id: string) => `wa:batch:lock:${id}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Programa la respuesta del bot para esta conversación. Devuelve cuando la
 * respuesta se mandó, o enseguida si otro mensaje posterior se hizo cargo de la
 * tanda.
 */
export async function scheduleAIReply(conversationId: string): Promise<void> {
  let seq: number;
  let waitedFrom: number;

  try {
    seq = await redis.incr(seqKey(conversationId));
    if (seq === 1) await redis.expire(seqKey(conversationId), KEY_TTL_S);

    // El primer mensaje de la tanda marca desde cuándo estamos esperando; los
    // siguientes leen esa marca (NX = sólo escribe si no existía).
    const first = await redis.set(sinceKey(conversationId), String(Date.now()), 'EX', KEY_TTL_S, 'NX');
    if (first === null) {
      waitedFrom = Number(await redis.get(sinceKey(conversationId))) || Date.now();
    } else {
      waitedFrom = Date.now();
    }
  } catch {
    // Sin Redis no podemos agrupar: contestamos este mensaje y listo.
    await runAI(conversationId);
    return;
  }

  const restante = waitedFrom + MAX_WAIT_MS - Date.now();
  await sleep(Math.max(0, Math.min(QUIET_MS, restante)));

  try {
    // ¿Entró otro mensaje mientras esperábamos? Entonces ESE se encarga de
    // contestar la tanda completa y nosotros nos borramos.
    const actual = Number(await redis.get(seqKey(conversationId)));
    if (actual && actual !== seq) return;
    await redis.del(seqKey(conversationId), sinceKey(conversationId));
  } catch {
    // Redis se cayó en el medio: mejor contestar igual.
  }

  // Una sola respuesta a la vez POR CHAT. Llamar al modelo tarda unos segundos:
  // si en el medio entra otro mensaje, arranca otra tanda que corre en paralelo
  // y termina contestando lo mismo dos veces (con otras palabras). Con el lock,
  // la segunda espera a que la primera termine y recién ahí mira el hilo, ya
  // completo y con nuestra respuesta adentro.
  let lock = false;
  const hasta = Date.now() + LOCK_WAIT_MS;
  try {
    while (Date.now() < hasta) {
      if (await redis.set(lockKey(conversationId), '1', 'EX', LOCK_TTL_S, 'NX')) {
        lock = true;
        break;
      }
      await sleep(LOCK_POLL_MS);
    }
  } catch {
    // Sin Redis no hay lock: contestamos igual (peor es no contestar).
  }

  try {
    await runAI(conversationId);
  } finally {
    if (lock) await redis.del(lockKey(conversationId)).catch(() => {});
  }
}

/**
 * Corre la IA con el estado FRESCO de la conversación. Hay que releerla: entre
 * que llegó el mensaje y que se venció la espera, el pedido pudo haber cambiado
 * (o alguien pudo haber tomado el chat a mano desde el panel).
 */
async function runAI(conversationId: string): Promise<void> {
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) return;
  // Takeover humano mientras esperábamos: el bot ya no responde este chat.
  if (convo.botPaused) return;

  const { handleAIOrder } = await import('./wa-order-flow.service');
  await handleAIOrder({ id: convo.id, phone: convo.phone, context: convo.context }, '');
}
