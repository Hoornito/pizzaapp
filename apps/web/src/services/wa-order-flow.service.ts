import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { sendText } from '@/lib/whatsapp';
import { toNumber } from '@/lib/utils';
import { flavorPrice, pizzaPrice } from '@/lib/pizza';
import { PIZZA_SIZE_LABELS, type PizzaSize, type ProductWithCategory } from '@/types/product.types';
import { TRANSFER_INFO } from '@/lib/constants';
import { isStoreOpen } from '@/services/finance.service';
import { createOrder } from '@/services/order.service';
import { getWAMenu, norm, type WAMenu } from '@/services/wa-menu.service';
import { parseOrder, type ParsedDraft, type ParsedItem, type ParserTurn } from '@/services/wa-parser.service';
import { generatePurchaseToken, logMessage } from '@/services/whatsapp.service';
import { availableProviders, defaultProvider, type AIProvider } from '@/lib/ai-provider';
import type { CreateOrderInput } from '@/lib/validators';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ─── Estado del pedido (en conversation.context) ────────────────────────────
// - flow: color/estado de la caja del chat. Ausente = normal (IA tomando).
//     'ready'       → 🟢 pedido armado, listo para que una persona lo tome.
//     'needs_human' → 🔴 la IA no puede seguir; atiende una persona.
// - readyOrder: pedido ya resuelto (con precios de la DB) para revisar y confirmar.
// - session.startedAt: separa "pedidos" (mañana/noche): el historial que ve la IA
//   arranca desde ahí.
export type WAFlow = 'ready' | 'needs_human';

interface ReadyOrderItem {
  label: string; // sin la cantidad adelante (la agrega la UI/los mensajes)
  productId: string | null;
  promotionId: string | null;
  quantity: number;
  unitPrice: number; // precio base del ítem (DB)
  /** Texto del agregado que se cobra (ej "huevo"), o null. */
  extra: string | null;
  /**
   * Precio del extra POR UNIDAD. Sale solo de la categoría "extras" si el
   * agregado está cargado ahí; si no, queda en 0 y lo pone el operador.
   */
  extraPrice: number;
  notes: string | null; // molde / sustituciones (NO el extra)
}
export interface ReadyOrder {
  items: ReadyOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'DELIVERY' | 'PICKUP';
  address: { street: string; number: string; apartment: string | null; reference: string | null } | null;
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA';
  customerName: string | null;
  /** Efectivo: con cuanto abona (para el vuelto). */
  cashReceived: number | null;
  /** Pedido programado: hora pedida por el cliente, "HH:MM". */
  scheduledFor: string | null;
}
interface LastOrderSnapshot {
  number: string;
  at: number;
  deliveryType: 'DELIVERY' | 'PICKUP';
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA';
  address: ReadyOrder['address'];
  customerName: string | null;
}
interface WAContext {
  session?: { startedAt: number };
  flow?: WAFlow;
  readyOrder?: ReadyOrder;
  // Último pedido tomado en este chat: si el cliente vuelve a escribir dentro de
  // la ventana, lo nuevo se toma como "agregado" vinculado a ese pedido.
  lastOrder?: LastOrderSnapshot;
  // Cuando readyOrder es un agregado, acá va el número del pedido original.
  addonOf?: string;
  // Motivo por el que la IA derivó a una persona (extra a cobrar, consulta de
  // stock, etc.), para mostrárselo al operador en el chat.
  humanReason?: string;
  // Proveedor de IA fijado para ESTE chat (para comparar Claude vs Gemini con
  // el mismo pedido). Ausente = el configurado por env.
  provider?: AIProvider;
}

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 h separa pedidos de distintos momentos
// Ventana para sumar "agregados" a un pedido recién tomado (misma tanda/envío).
const ADDON_WINDOW_MS = 60 * 60 * 1000;
const HISTORY_LIMIT = 16; // últimos mensajes que ve la IA
// 16 y no 40: el historial es la ÚNICA parte del prompt que cambia en cada
// turno, así que es la única que no se puede cachear y se paga entera siempre.
// Un pedido por chat rara vez pasa de 8 idas y vueltas.
// Al iniciar una sesión, miramos un ratito hacia atrás para incluir el mensaje
// entrante (que se guardó unos ms antes de calcular el corte).
const NEW_SESSION_LOOKBACK_MS = 60 * 1000;

// ─── Rate limit anti-spam (por teléfono) ────────────────────────────────────
const RL_WINDOW_S = 600;
const RL_MAX = 20;
async function checkRate(phone: string): Promise<'ok' | 'just-blocked' | 'blocked'> {
  const key = `wa:ai:rl:${phone}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, RL_WINDOW_S);
  if (n <= RL_MAX) return 'ok';
  return n === RL_MAX + 1 ? 'just-blocked' : 'blocked';
}

// ─── Kill-switch global de la IA ────────────────────────────────────────────
// Apaga la IA en TODOS los chats sin tocar cada conversación: los mensajes nuevos
// quedan sin responder, para atención humana. Se guarda en Redis (sin migración).
const AI_KILL_KEY = 'wa:ai:kill';
export async function isAIGloballyDisabled(): Promise<boolean> {
  try {
    return (await redis.get(AI_KILL_KEY)) === '1';
  } catch {
    return false;
  }
}
export async function setAIGloballyDisabled(disabled: boolean): Promise<void> {
  if (disabled) await redis.set(AI_KILL_KEY, '1');
  else await redis.del(AI_KILL_KEY);
}

async function pauseBot(conversationId: string, paused = true) {
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { botPaused: paused } });
}

function loadContext(raw: unknown): WAContext {
  const c = (raw ?? {}) as WAContext;
  return c && typeof c === 'object' ? c : {};
}
async function saveContext(conversationId: string, ctx: WAContext | null) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { context: (ctx ?? {}) as unknown as Prisma.InputJsonValue },
  });
}

/** Reconstruye el historial para la IA desde el hilo (IN=cliente, OUT=nosotros). */
async function buildHistory(conversationId: string, sinceMs: number): Promise<ParserTurn[]> {
  const msgs = await prisma.whatsAppMessage.findMany({
    where: { conversationId, createdAt: { gte: new Date(sinceMs) } },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
  });
  const turns: ParserTurn[] = [];
  for (const m of msgs) {
    const text = m.type === 'image' ? '[el cliente envió una imagen]' : (m.body ?? '').trim();
    if (!text) continue;
    turns.push({ role: m.direction === 'IN' ? 'user' : 'assistant', text });
  }
  return turns;
}

/** Manda un texto por WhatsApp y lo registra en el hilo. */
async function botSay(conversationId: string, phone: string, text: string) {
  let status: string | null = 'sent';
  try {
    await sendText(phone, text);
  } catch {
    status = 'failed';
  }
  await logMessage(conversationId, { direction: 'OUT', type: 'text', body: text, status });
}

async function setRed(conversationId: string, ctx: WAContext) {
  ctx.flow = 'needs_human';
  ctx.readyOrder = undefined;
  await saveContext(conversationId, ctx);
  await pauseBot(conversationId);
}

/**
 * Entrada del pedido por chat con IA. La IA arma el pedido; NO lo crea sola:
 * cuando el cliente confirma, deja el pedido listo (🟢) para que una persona lo
 * tome. Si aparece algo que la IA no puede responder, deriva a humano (🔴).
 */
export async function handleAIOrder(
  conversation: { id: string; phone: string; context: unknown },
  _incomingText: string,
  opts?: { skipStoreCheck?: boolean; provider?: AIProvider }
): Promise<void> {
  const { id, phone } = conversation;

  // IA apagada globalmente: no respondemos nada; el mensaje queda para una persona.
  if (await isAIGloballyDisabled()) return;

  // Sin ningún proveedor con API key cargada no hay bot, y sin bot NO mandamos
  // ninguna respuesta automática: el chat queda entero para atención humana.
  if (availableProviders().length === 0) return;

  if (!opts?.skipStoreCheck && !(await isStoreOpen())) {
    await botSay(id, phone, 'Por ahora estamos cerrados 🕒 Escribinos cuando abramos y te tomamos el pedido. ¡Gracias!');
    return;
  }

  const rate = await checkRate(phone);
  if (rate === 'just-blocked') {
    await botSay(id, phone, 'Estamos con mucha demanda 🙌 En un ratito te responde una persona.');
    return;
  }
  if (rate === 'blocked') return;

  const menu = await getWAMenu();
  const ctx = loadContext(conversation.context);
  // Proveedor de IA: el que pidió el simulador manda y queda fijado en el chat;
  // si no, el que ya tenía; si no, el de la configuración.
  if (opts?.provider) ctx.provider = opts.provider;
  const provider = ctx.provider ?? defaultProvider();
  // Límite de sesión: si venció, arranca un pedido nuevo (mirando un ratito atrás
  // para no dejar afuera el mensaje que acaba de entrar).
  const startedAt =
    ctx.session && Date.now() - ctx.session.startedAt < SESSION_TTL_MS
      ? ctx.session.startedAt
      : Date.now() - NEW_SESSION_LOOKBACK_MS;
  ctx.session = { startedAt };

  // El mensaje entrante ya quedó guardado en el hilo antes de llamarnos.
  const history = await buildHistory(id, startedAt);
  const draft = await parseOrder(menu.menuText, history, provider);

  // IA no disponible / falló → derivamos a una persona.
  if (!draft) {
    await setRed(id, ctx);
    await botSay(id, phone, 'Dame un momento que te atiende una persona 🙌');
    return;
  }

  if (draft.intent === 'cancel') {
    await saveContext(id, { session: { startedAt: Date.now() }, provider: ctx.provider });
    await botSay(id, phone, draft.reply || 'Listo, cancelé el pedido. Cuando quieras arrancamos de nuevo 🍕');
    return;
  }

  // El cliente pregunta algo fuera de alcance (stock, reclamos…) → 🔴. Un extra a
  // cobrar NO frena acá: lo maneja respondToDraft (le pone precio solo, y si no lo
  // tiene cargado frena recién al final).
  if (draft.needsHuman && !hasExtra(draft)) {
    ctx.humanReason = draft.humanReason?.trim() || draft.reply || 'Consulta fuera del menú';
    await setRed(id, ctx);
    await botSay(id, phone, draft.reply || 'Buena pregunta 🙌 Dejame que te confirma una persona en un ratito.');
    return;
  }

  // ¿El cliente vuelve a escribir justo después de un pedido tomado? Lo nuevo se
  // encara como AGREGADO vinculado: lo dejamos en 🔴 para que una persona lo tome.
  if (ctx.lastOrder && Date.now() - ctx.lastOrder.at < ADDON_WINDOW_MS && draft.items.length) {
    await stageAddon(id, phone, menu, draft, ctx);
    return;
  }

  await respondToDraft({ id, phone }, menu, draft, ctx);
}

/** ¿El pedido suma algún agregado que se cobra? */
function hasExtra(draft: ParsedDraft): boolean {
  return draft.items.some((it) => it.extra && it.extra.trim());
}

/** Agregados del pedido armado que quedaron SIN precio (no están en "extras"). */
function unpricedExtras(ro: ReadyOrder): string[] {
  return ro.items.filter((it) => it.extra && !it.extraPrice).map((it) => it.extra!);
}

/**
 * El pedido está completo pero tiene agregados sin precio cargado: lo deja armado
 * con los precios de base y pasa a 🔴 para que una persona le ponga el precio del
 * extra (botón Editar) y lo tome. No hay que reactivar el bot para esto.
 * (Si el agregado está cargado en la categoría "extras", esto no pasa: el pedido
 * sigue solo y queda 🟢.)
 */
async function stageExtra(
  id: string,
  phone: string,
  ctx: WAContext,
  readyOrder: ReadyOrder,
  pending: string[]
): Promise<void> {
  ctx.flow = 'needs_human';
  ctx.addonOf = undefined;
  ctx.readyOrder = readyOrder;
  const list = pending.join(', ');
  ctx.humanReason = list ? `Extra sin precio: ${list}` : 'Extra a cobrar';
  await saveContext(id, ctx);
  await pauseBot(id);
  await botSay(id, phone, `El agregado${list ? ` de ${list}` : ''} te lo confirma una persona con el precio 🙌 En un ratito seguimos.`);
}

/**
 * Prepara un "agregado" a un pedido ya tomado: arma los ítems nuevos con precios
 * de la DB (sin re-cobrar envío), hereda entrega/pago del pedido original y deja
 * el chat en 🔴 con el agregado listo para que una persona lo tome.
 */
async function stageAddon(
  id: string,
  phone: string,
  menu: WAMenu,
  draft: ParsedDraft,
  ctx: WAContext
): Promise<void> {
  const lo = ctx.lastOrder!;
  ctx.flow = 'needs_human';
  ctx.addonOf = lo.number;

  const items: ReadyOrderItem[] = [];
  let ok = true;
  for (const it of draft.items) {
    const r = resolveItem(menu, it);
    if ('error' in r) { ok = false; break; }
    items.push(r);
  }
  if (ok && items.length) {
    const subtotal = items.reduce((s, r) => s + lineTotal(r), 0);
    ctx.readyOrder = {
      items, subtotal, deliveryFee: 0, total: subtotal,
      deliveryType: lo.deliveryType, address: lo.address,
      paymentMethod: lo.paymentMethod, customerName: lo.customerName,
      // Un agregado se suma a un pedido ya tomado: ni vuelto ni horario propios,
      // los hereda del original.
      cashReceived: null, scheduledFor: null,
    };
  } else {
    // No pudimos poner precio (o pidió algo raro): que la persona lo arme a mano.
    ctx.readyOrder = undefined;
  }

  await saveContext(id, ctx);
  await pauseBot(id);
  await botSay(id, phone, `Perfecto, se lo sumo a tu pedido #${lo.number} 🙌 En un ratito te confirmo.`);
}

type AssembleResult =
  | { status: 'ask'; message: string }
  | { status: 'mp' }
  | { status: 'error'; item: string }
  | { status: 'ready'; readyOrder: ReadyOrder };

/** Arma el pedido con precios reales de la DB, o dice qué falta. Sin efectos. */
async function assembleOrder(menu: WAMenu, draft: ParsedDraft): Promise<AssembleResult> {
  if (!draft.items.length) return { status: 'ask', message: 'Contame qué te gustaría pedir 🍕' };
  if (!draft.deliveryType) return { status: 'ask', message: '¿Es para envío (delivery) o lo retirás por el local?' };
  if (draft.deliveryType === 'DELIVERY' && !draft.address)
    return { status: 'ask', message: 'Para el envío pasame la dirección: calle, número y entre qué calles 🙏' };
  if (!draft.paymentMethod) return { status: 'ask', message: '¿Cómo abonás? Efectivo, transferencia o Mercado Pago.' };
  if (draft.paymentMethod === 'MERCADO_PAGO') return { status: 'mp' };

  const items: ReadyOrderItem[] = [];
  for (const item of draft.items) {
    const r = resolveItem(menu, item);
    if ('error' in r) return { status: 'error', item: r.error };
    items.push(r);
  }
  const subtotal = items.reduce((s, r) => s + lineTotal(r), 0);
  const deliveryFee = draft.deliveryType === 'DELIVERY' ? await getDefaultDeliveryFee() : 0;
  return {
    status: 'ready',
    readyOrder: {
      items, subtotal, deliveryFee, total: subtotal + deliveryFee,
      deliveryType: draft.deliveryType, address: draft.address,
      paymentMethod: draft.paymentMethod, customerName: draft.customerName,
      cashReceived: draft.cashReceived, scheduledFor: draft.scheduledFor,
    },
  };
}

/** Etiqueta con cantidad y agregado ("2× Muzzarella + huevo"). */
function qtyLabel(it: ReadyOrderItem): string {
  const base = it.quantity > 1 ? `${it.quantity}× ${it.label}` : it.label;
  return it.extra ? `${base} + ${it.extra}` : base;
}

/** Resumen corto con el total (desde la DB) para que el cliente confirme. */
function summaryText(ro: ReadyOrder): string {
  const pago = ro.paymentMethod === 'TRANSFERENCIA' ? 'transferencia' : 'efectivo';
  const entrega = ro.deliveryType === 'DELIVERY'
    ? `Envío${ro.address ? ` a ${ro.address.street} ${ro.address.number}` : ''}`
    : 'Retira en el local';
  return [
    '📋 *Tu pedido:*',
    ...ro.items.map((it) => `• ${qtyLabel(it)}`),
    `*Total: ${money(ro.total)}*`,
    `${entrega} · ${pago}`,
    '¿Confirmás? 🙂',
  ].join('\n');
}

/**
 * Responde según el borrador del modelo. Si ya tiene todo: muestra el resumen con
 * total y pide confirmar. Si el cliente confirma: deja el pedido armado (🟢) para
 * que una persona lo tome con "Tomar pedido".
 */
async function respondToDraft(
  conv: { id: string; phone: string },
  menu: WAMenu,
  draft: ParsedDraft,
  ctx: WAContext
): Promise<void> {
  const { id, phone } = conv;
  const a = await assembleOrder(menu, draft);

  if (a.status === 'mp') {
    const token = await generatePurchaseToken(phone);
    ctx.flow = undefined; ctx.readyOrder = undefined; await saveContext(id, ctx);
    await botSay(id, phone, `Para pagar con Mercado Pago armá tu pedido acá 👇\n${APP_URL}/pedido/${token}\n\n_El enlace vale 2 horas._`);
    return;
  }
  if (a.status === 'error') {
    // No entendimos un ítem: pedimos que lo aclare (no frenamos el pedido).
    ctx.flow = undefined; ctx.readyOrder = undefined; await saveContext(id, ctx);
    await botSay(id, phone, clarifyItemText(a.item));
    return;
  }
  if (a.status === 'ask') {
    // Falta info: dejamos que el modelo maneje la charla (preguntar tamaño,
    // variedad de empanada, etc.); su "reply" es más natural que el mensaje fijo.
    ctx.flow = undefined; ctx.readyOrder = undefined; await saveContext(id, ctx);
    await botSay(id, phone, draft.reply || a.message);
    return;
  }
  // a.status === 'ready': el pedido está COMPLETO.
  // Los extras cargados en la categoría "extras" ya vienen con precio: el pedido
  // sigue solo. Sólo frena (🔴) si quedó algún agregado sin precio.
  const pending = unpricedExtras(a.readyOrder);
  if (pending.length) {
    await stageExtra(id, phone, ctx, a.readyOrder, pending);
    return;
  }
  // Sin extra → 🟢: el botón "Tomar pedido" queda disponible aunque el cliente no
  // haya dado el OK final (la persona puede tomarlo igual).
  ctx.flow = 'ready'; ctx.readyOrder = a.readyOrder; ctx.addonOf = undefined; await saveContext(id, ctx);
  if (draft.intent === 'confirm') {
    await botSay(id, phone, '¡Genial! 🍕 Ya paso tu pedido al local, en un ratito te confirmamos. ¡Gracias!');
  } else {
    await botSay(id, phone, summaryText(a.readyOrder));
  }
}

/** Mensaje para pedirle al cliente que aclare un ítem que no pudimos identificar. */
function clarifyItemText(item: string): string {
  if (item.toLowerCase().includes('tamaño')) return '¿De qué tamaño la pizza? Individual, Mediana o Grande 🍕';
  const clean = item.replace(/^"|"$/g, '');
  return `Perdón, no me quedó claro lo de ${clean} 🤔 ¿Me confirmás qué es? (por ejemplo: empanada, pizza, bebida…)`;
}

/**
 * Una persona toca "Tomar pedido": crea el pedido con el borrador armado y le
 * manda la confirmación al cliente. Devuelve el número de pedido.
 */
/**
 * Pasa la hora que pidio el cliente ("HH:MM") a una fecha concreta. Si esa hora
 * ya paso hoy, se entiende para manana (alguien que a las 23:40 pide "para las
 * 12" quiere el mediodia siguiente). Devuelve null si el texto no es una hora.
 */
function scheduledDate(hhmm: string | null): Date | null {
  const m = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.exec((hhmm ?? '').trim());
  if (!m) return null;
  const when = new Date();
  when.setSeconds(0, 0);
  when.setHours(Number(m[1]), Number(m[2]));
  if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
  return when;
}

export async function takeReadyOrder(conversationId: string, userId: string): Promise<string> {
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) throw new Error('Conversación no encontrada');
  const ctx = loadContext(convo.context);
  const ro = ctx.readyOrder;
  if (!ro) throw new Error('Este chat no tiene un pedido listo para tomar.');

  // Nombre a mostrar: el que se cargó en el panel (editable) manda sobre el que
  // haya dado el cliente en el chat.
  const displayName = convo.contactName?.trim() || ro.customerName?.trim() || null;
  const uid = await findOrCreateWAUser(convo.phone, displayName);

  const input: CreateOrderInput = {
    deliveryType: ro.deliveryType,
    paymentMethod: ro.paymentMethod,
    subtotal: ro.subtotal,
    deliveryFee: ro.deliveryFee,
    total: ro.total,
    // Transferencia: se marca pagado automáticamente (si no pagan, se quita a mano).
    // Efectivo: flujo normal, se cobra al entregar/retirar.
    paid: ro.paymentMethod === 'TRANSFERENCIA',
    phone: convo.phone,
    // El "Cliente: X · ..." es la convención que ya usa el mostrador; la tarjeta
    // de Pedidos lo levanta con splitClientNote y lo muestra destacado.
    notes: [
      displayName ? `Cliente: ${displayName}` : null,
      'Pedido tomado por WhatsApp (IA), confirmado por el local.',
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'WHATSAPP',
    // "Paga con": solo aplica a efectivo; con esto el sistema calcula el vuelto.
    ...(ro.paymentMethod === 'EFECTIVO' && ro.cashReceived ? { cashReceived: ro.cashReceived } : {}),
    // Pedido programado: mismo campo que usa el alta manual, asi la tarjeta y
    // los tickets lo muestran igual que cualquier otro pedido con horario.
    ...(() => {
      const when = scheduledDate(ro.scheduledFor);
      return when ? { scheduledFor: when.toISOString() } : {};
    })(),
    items: ro.items.map(toOrderItemInput),
    ...(ro.deliveryType === 'DELIVERY' && ro.address
      ? {
          address: {
            street: ro.address.street,
            number: ro.address.number,
            apartment: ro.address.apartment ?? undefined,
            city: 'San Vicente',
            reference: ro.address.reference ?? undefined,
          },
        }
      : {}),
  };

  // Al tomarlo desde el chat: confirmar e imprimir la comanda (como el mostrador).
  const order = await createOrder(uid, input, { printOnCreate: true, confirmImmediately: true });

  const lines = [`✅ *¡Pedido confirmado!*  #${order.orderNumber}`, '', `*Total:* ${money(ro.total)}`];
  if (ro.deliveryType === 'DELIVERY') lines.push(`_(incluye envío ${money(ro.deliveryFee)})_`);
  if (ro.paymentMethod === 'TRANSFERENCIA') {
    lines.push('', `💳 Transferí a *${TRANSFER_INFO.alias}* (${TRANSFER_INFO.holder}) y mandanos el comprobante por acá.`);
  } else {
    lines.push('', '💵 Abonás en efectivo al recibir/retirar.');
  }
  lines.push('', '¡Gracias! Te avisamos cuando esté listo 🍕');
  await botSay(conversationId, convo.phone, lines.join('\n'));

  // Pedido cerrado: reiniciamos la sesión DESPUÉS de la confirmación (así, si el
  // cliente suma algo, la IA no vuelve a ver el pedido viejo y solo toma lo nuevo)
  // y guardamos el snapshot para "agregados" (próxima hora). Reactivamos el bot.
  await pauseBot(conversationId, false);
  await saveContext(conversationId, {
    session: { startedAt: Date.now() },
    provider: ctx.provider,
    lastOrder: {
      number: order.orderNumber,
      at: Date.now(),
      deliveryType: ro.deliveryType,
      paymentMethod: ro.paymentMethod,
      address: ro.address,
      customerName: ro.customerName,
    },
  });

  return order.orderNumber;
}

/** Próximo número para un agregado vinculado (#TM003-2, -3, …). */
async function nextAddonNumber(base: string): Promise<string> {
  const rows = await prisma.order.findMany({
    where: { orderNumber: { startsWith: `${base}-` } },
    select: { orderNumber: true },
  });
  let max = 1;
  for (const r of rows) {
    const n = parseInt(r.orderNumber.slice(base.length + 1), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${base}-${max + 1}`;
}

/**
 * Una persona toma el AGREGADO armado: crea un pedido vinculado (#original-N) con
 * SOLO lo nuevo (sin re-cobrar envío), lo confirma e imprime una comanda aparte
 * encabezada con el pedido original.
 */
export async function takeAddonOrder(conversationId: string, userId: string): Promise<string> {
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) throw new Error('Conversación no encontrada');
  const ctx = loadContext(convo.context);
  const ro = ctx.readyOrder;
  const base = ctx.addonOf;
  if (!ro || !base) throw new Error('Este chat no tiene un agregado listo para tomar.');

  // Nombre a mostrar: el que se cargó en el panel (editable) manda sobre el que
  // haya dado el cliente en el chat.
  const displayName = convo.contactName?.trim() || ro.customerName?.trim() || null;
  const uid = await findOrCreateWAUser(convo.phone, displayName);
  const input: CreateOrderInput = {
    deliveryType: ro.deliveryType,
    paymentMethod: ro.paymentMethod,
    subtotal: ro.subtotal,
    deliveryFee: 0, // el envío ya se cobró en el pedido original
    total: ro.subtotal,
    paid: ro.paymentMethod === 'TRANSFERENCIA',
    phone: convo.phone,
    notes: `AGREGADO AL PEDIDO #${base}`,
    items: ro.items.map(toOrderItemInput),
    ...(ro.deliveryType === 'DELIVERY' && ro.address
      ? { address: { street: ro.address.street, number: ro.address.number, apartment: ro.address.apartment ?? undefined, city: 'San Vicente', reference: ro.address.reference ?? undefined } }
      : {}),
  };

  // Número forzado #base-N; si choca (otro agregado a la vez), recalculamos.
  let order: Awaited<ReturnType<typeof createOrder>> | null = null;
  for (let i = 0; i < 6; i++) {
    const explicitOrderNumber = await nextAddonNumber(base);
    try {
      order = await createOrder(uid, input, { printOnCreate: true, confirmImmediately: true, explicitOrderNumber });
      break;
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') continue;
      throw e;
    }
  }
  if (!order) throw new Error('No se pudo crear el agregado (numeración).');

  const lines = [
    `✅ *¡Agregado confirmado!*  #${order.orderNumber}`,
    ...ro.items.map((it) => `• ${qtyLabel(it)}`),
    `*Total agregado:* ${money(ro.subtotal)}`,
  ];
  if (ro.paymentMethod === 'TRANSFERENCIA') {
    lines.push('', `💳 Sumá ${money(ro.subtotal)} a la transferencia a *${TRANSFER_INFO.alias}*.`);
  }
  await botSay(conversationId, convo.phone, lines.join('\n'));

  // Reiniciamos sesión DESPUÉS de confirmar (para no re-ver lo ya tomado),
  // mantenemos la ventana de agregados abierta por si suma algo más, y reactivamos.
  await pauseBot(conversationId, false);
  await saveContext(conversationId, {
    session: { startedAt: Date.now() },
    provider: ctx.provider,
    lastOrder: { ...ctx.lastOrder!, at: Date.now() },
  });

  return order.orderNumber;
}

/**
 * Edición manual del pedido armado (botón "Editar"): reemplaza los ítems por los
 * que dejó el operador (agregar/quitar del menú, ajustar precio del extra, editar
 * aclaraciones), recalcula totales y deja el pedido listo para tomar.
 */
export interface EditItemInput {
  productId?: string | null;
  promotionId?: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  extra?: string | null;
  extraPrice?: number;
  notes?: string | null;
}
export async function editReadyOrder(conversationId: string, editItems: EditItemInput[]): Promise<void> {
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) throw new Error('Conversación no encontrada');
  const ctx = loadContext(convo.context);
  const ro = ctx.readyOrder;
  if (!ro) throw new Error('No hay un pedido para editar.');

  const items: ReadyOrderItem[] = editItems
    .map((e) => ({
      label: e.label.trim() || 'Ítem',
      productId: e.productId ?? null,
      promotionId: e.promotionId ?? null,
      quantity: Math.max(1, Math.floor(e.quantity || 1)),
      unitPrice: Math.max(0, Math.round(e.unitPrice || 0)),
      extra: e.extra?.trim() ? e.extra.trim() : null,
      extraPrice: Math.max(0, Math.round(e.extraPrice || 0)),
      notes: e.notes?.trim() ? e.notes.trim() : null,
    }));
  if (!items.length) throw new Error('El pedido no puede quedar vacío.');

  const subtotal = items.reduce((s, r) => s + lineTotal(r), 0);
  ctx.readyOrder = { ...ro, items, subtotal, total: subtotal + ro.deliveryFee };
  // Editar deja el pedido listo para tomar. Si es un agregado, conserva ese modo
  // (queda en 🔴 con "Tomar agregado"); si no, pasa a 🟢.
  if (!ctx.addonOf) ctx.flow = 'ready';
  await saveContext(conversationId, ctx);
}

/**
 * Se reactiva la IA en un chat que estaba en 🔴 (después de que una persona
 * respondió): la IA retoma el pedido con todo el hilo (incluida la respuesta
 * humana) y sigue armándolo.
 */
export async function resumeAI(conversationId: string): Promise<void> {
  if (await isAIGloballyDisabled()) return;
  const convo = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!convo) return;
  const ctx = loadContext(convo.context);
  ctx.flow = undefined;
  const startedAt =
    ctx.session?.startedAt && Date.now() - ctx.session.startedAt < SESSION_TTL_MS
      ? ctx.session.startedAt
      : Date.now() - NEW_SESSION_LOOKBACK_MS;
  ctx.session = { startedAt };
  await saveContext(conversationId, ctx);

  const menu = await getWAMenu();
  const history = await buildHistory(conversationId, startedAt);
  if (!history.length) return;

  const draft = await parseOrder(menu.menuText, history, ctx.provider ?? defaultProvider());
  if (!draft) return; // seguimos con la persona; no forzamos nada

  if (draft.needsHuman && !hasExtra(draft)) {
    ctx.humanReason = draft.humanReason?.trim() || draft.reply || 'Consulta fuera del menú';
    await setRed(conversationId, ctx);
    return;
  }
  await respondToDraft({ id: conversationId, phone: convo.phone }, menu, draft, ctx);
}

// ─── Resolución de precios (SIEMPRE desde la DB, nunca del modelo) ───────────

// Notas del ítem SIN el extra (el extra se guarda aparte, con su precio, y se
// compone recién al crear el pedido — ver finalItemNote/finalUnitPrice).
function composeNotes(base: string | null, molde: boolean): string | null {
  const lines = [base, molde ? 'AL MOLDE' : ''].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

/** Precio efectivo por unidad = base + extra. */
function unitWithExtra(r: ReadyOrderItem): number {
  return r.unitPrice + (r.extraPrice || 0);
}
/** Total de la línea. */
function lineTotal(r: ReadyOrderItem): number {
  return unitWithExtra(r) * r.quantity;
}
/** Nota final para el pedido: base + el extra con su precio (si tiene). */
function finalItemNote(r: ReadyOrderItem): string | null {
  const extraLine = r.extra ? `EXTRA: ${r.extra.toUpperCase()}${r.extraPrice ? ` (+${money(r.extraPrice)})` : ''}` : '';
  const lines = [r.notes, extraLine].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

/** Convierte un ítem armado en el ítem del pedido: el precio unitario ya incluye el extra. */
function toOrderItemInput(r: ReadyOrderItem) {
  return {
    productId: r.productId,
    promotionId: r.promotionId,
    quantity: r.quantity,
    unitPrice: unitWithExtra(r),
    notes: finalItemNote(r) ?? undefined,
  };
}

function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const target = norm(name);
  return (
    list.find((x) => norm(x.name) === target) ??
    list.find((x) => norm(x.name).includes(target) || target.includes(norm(x.name)))
  );
}

/**
 * Busca un agregado en la categoría "extras". El texto del modelo puede venir
 * como "extra de huevo" o "huevo", así que sacamos el prefijo y comparamos.
 * Prioriza el nombre MÁS LARGO contenido en el texto, para que "doble muzzarella"
 * no caiga en "muzzarella" si ambos están cargados.
 */
function findExtraProduct(extras: ProductWithCategory[], text: string): ProductWithCategory | undefined {
  const target = norm(text).replace(/^(extra|extras|agregado|adicional)\s+/, '').replace(/^de\s+/, '').trim();
  if (!target) return undefined;

  const exact = extras.find((e) => norm(e.name) === target);
  if (exact) return exact;

  const contained = extras
    .filter((e) => target.includes(norm(e.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (contained.length) return contained[0];

  // Último intento al revés: el cliente dijo menos de lo que dice el nombre
  // cargado (ej "panceta" → "Panceta ahumada").
  return extras
    .filter((e) => norm(e.name).includes(target))
    .sort((a, b) => a.name.length - b.name.length)[0];
}

/**
 * Precio por unidad del agregado, desde la categoría "extras". Si el extra tiene
 * precios por tamaño cargados (como las pizzas), usa el del tamaño del ítem.
 * Devuelve 0 si el agregado no está cargado → el pedido va a 🔴 y lo pone una persona.
 */
function resolveExtraPrice(menu: WAMenu, extra: string | null, size: PizzaSize | null): number {
  if (!extra) return 0;
  const prod = findExtraProduct(menu.extras, extra);
  if (!prod) return 0;
  if (size) {
    const bySize = flavorPrice(prod, size);
    if (bySize != null) return bySize;
  }
  return toNumber(prod.price);
}

function resolveItem(menu: WAMenu, item: ParsedItem): ReadyOrderItem | { error: string } {
  const qty = Math.max(1, Math.floor(item.quantity || 1));
  const extra = item.extra && item.extra.trim() ? item.extra.trim() : null;

  if (item.kind === 'promo') {
    const promo = findByName(menu.promotions, item.name);
    if (!promo) return { error: `promo "${item.name}"` };
    return { label: promo.name, productId: null, promotionId: promo.id, quantity: qty, unitPrice: promo.price, extra, extraPrice: resolveExtraPrice(menu, extra, null), notes: composeNotes(item.notes, item.molde) };
  }

  if (item.kind === 'pizza') {
    if (!item.size) return { error: `tamaño de pizza` };
    const size = item.size as PizzaSize;
    const flavorNames = item.flavors.length ? item.flavors : [item.name];
    const flavors: ProductWithCategory[] = [];
    for (const fn of flavorNames) {
      const p = findByName(menu.pizzas, fn);
      if (!p) return { error: `gusto "${fn}"` };
      if (flavorPrice(p, size) == null) return { error: `"${p.name}" en ${PIZZA_SIZE_LABELS[size]}` };
      flavors.push(p);
    }
    const unitPrice = pizzaPrice(flavors.map((f) => flavorPrice(f, size)!));
    const flavorLabel = flavors.length === 1 ? flavors[0].name : flavors.map((f) => `½ ${f.name}`).join(' · ');
    const baseNote = `${PIZZA_SIZE_LABELS[size]} · ${flavorLabel}`;
    return { label: `${baseNote}${item.molde ? ' (al molde)' : ''}`, productId: flavors[0].id, promotionId: null, quantity: qty, unitPrice, extra, extraPrice: resolveExtraPrice(menu, extra, size), notes: composeNotes(baseNote, item.molde) };
  }

  const prod = findByName(menu.products, item.name);
  if (!prod) return { error: `"${item.name}"` };
  return { label: prod.name, productId: prod.id, promotionId: null, quantity: qty, unitPrice: toNumber(prod.price), extra, extraPrice: resolveExtraPrice(menu, extra, null), notes: composeNotes(item.notes, item.molde) };
}

async function getDefaultDeliveryFee(): Promise<number> {
  const fee = await prisma.deliveryFee.findFirst({ where: { isDefault: true }, orderBy: { createdAt: 'asc' } });
  return fee ? toNumber(fee.fee) : 0;
}

async function findOrCreateWAUser(phone: string, name: string | null): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return existing.id;
  const user = await prisma.user.create({ data: { phone, role: 'CUSTOMER', name: name || `Cliente WA ${phone.slice(-4)}` } });
  return user.id;
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
