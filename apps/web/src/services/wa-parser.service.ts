import { callStructured, defaultProvider, type AIProvider } from '@/lib/ai-provider';
import { getInstructions } from '@/services/wa-instructions.service';
import { getCorrectionExamples } from '@/services/wa-corrections.service';

export type ParsedIntent = 'ordering' | 'confirm' | 'cancel' | 'other';
export type ParsedSize = 'SMALL' | 'MEDIUM' | 'LARGE' | null;

export interface ParsedItem {
  kind: 'pizza' | 'promo' | 'producto';
  /** Nombre canónico del menú (promo/producto) o gusto único de la pizza. */
  name: string;
  /** Pizzas: 1 gusto (entera) o 2 (mitad y mitad). Vacío para no-pizzas. */
  flavors: string[];
  size: ParsedSize;
  quantity: number;
  molde: boolean;
  /**
   * Agregado que se cobra (ej. "huevo"). El precio lo pone el sistema desde la
   * categoría AGREGADOS; si el agregado no está cargado, lo pone una persona.
   */
  extra: string | null;
  notes: string | null;
}

export interface ParsedDraft {
  intent: ParsedIntent;
  items: ParsedItem[];
  deliveryType: 'DELIVERY' | 'PICKUP' | null;
  address: { street: string; number: string; apartment: string | null; reference: string | null } | null;
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'MERCADO_PAGO' | null;
  customerName: string | null;
  /** El modelo cree que ya tiene todo para confirmar. */
  ready: boolean;
  /**
   * El cliente pregunta/pide algo que el bot NO debe responder (si hay stock de
   * algo, un reclamo, cualquier cosa fuera de tomar el pedido). Cuando es true,
   * deriva a una persona. OJO: un "extra que se cobra" NO va por acá (se sigue
   * tomando el pedido; el precio del extra lo pone una persona al final).
   */
  needsHuman: boolean;
  /**
   * Si derivás a una persona (needsHuman) o hay un extra que se cobra, un motivo
   * corto y claro para el que atienda (ej: "extra de huevo a cobrar",
   * "pregunta si hay muzzarella sin TACC"). Si no aplica, null.
   */
  humanReason: string | null;
  /** Mensaje en lenguaje natural para responderle al cliente. */
  reply: string;
}

export interface ParserTurn {
  role: 'user' | 'assistant';
  text: string;
}

const SYSTEM = `Sos el asistente de pedidos por WhatsApp de "Pizzería Cambalache" (San Vicente, Argentina). Tomás pedidos de clientes en español rioplatense, de forma breve, amable y clara.

REGLAS:
- Trabajás SOLO con los ítems del MENÚ de abajo. Nunca inventes productos ni precios. No menciones precios vos: el sistema los calcula.
- Para cada ítem usá el nombre EXACTO como figura en el menú (para pizzas, el/los gusto/s exacto/s).
- Pizzas: preguntá tamaño (Individual/Mediana/Grande) y gusto. Aceptan mitad y mitad (2 gustos). Si el cliente no aclara el tamaño, preguntalo.
- "Al molde" es una preferencia de cocina (sin costo): marcá molde=true.
- DISTINGUÍ dos cosas muy distintas:
  • AGREGADO QUE SE COBRA → va en el campo "extra" (texto). Es sumar algo que tiene costo aparte: "extra de jamón", "agregale huevo", "doble muzzarella", "extra de queso". NO le pongas precio (lo pone una persona).
  • SUSTITUCIÓN / PREFERENCIA / QUITAR algo → NO es extra, va en "notes" y NO se cobra: "aceituna verde en vez de negra", "sin cebolla", "poca sal", "bien cocida", "cortada en cuadrados", "la salsa aparte". Ante la duda de si algo se cobra o no, tratalo como preferencia (notes), NO como extra.
- Pedí los datos que falten, de a poco: qué quiere pedir, si es envío (delivery) o retira por el local (pickup), la dirección si es delivery, y el medio de pago (efectivo, transferencia o Mercado Pago).
- Cuando tengas TODO, hacé un resumen del pedido y pedí que confirme ("¿te lo confirmo?"). Marcá ready=true.
- Cuando el cliente confirme explícitamente un pedido ya resumido, poné intent="confirm".
- Si el cliente quiere cancelar/empezar de nuevo, intent="cancel". Si escribe algo ajeno a un pedido, intent="other".
- La ciudad de envío es siempre San Vicente (no hace falta preguntarla).
- EXTRA que se cobra: cuando el cliente suma un ingrediente a un ítem ("muzza CON huevo", "con jamón", "agregale panceta", "extra de queso", "doble muzzarella"), eso es un EXTRA. Cargá ese ingrediente en el campo "extra" del ítem —si figura en la lista AGREGADOS del menú, escribilo con ESE nombre exacto— y SEGUÍ tomando el pedido con total normalidad (preguntá tamaño, entrega, pago, nombre). NO preguntes por el extra, NO avises que se cobra, NO pongas needsHuman: el sistema resuelve el precio del extra al final. Ej: "2 grandes de muzza con huevo" → 2 ítems pizza Muzzarella grandes, cada uno con extra="huevo".
- Pedir una aclaración NORMAL del menú (qué tamaño, si la empanada de carne es común/picante/a cuchillo, etc.) NO es derivar a humano: preguntalo vos en "reply" con needsHuman=false.
- DERIVAR A HUMANO (needsHuman=true): SOLO si el CLIENTE PREGUNTA algo que no podés resolver con el menú —si HAY STOCK/disponibilidad de algo, un reclamo, negociar precios, algo raro fuera de tomar el pedido—. Nunca por un extra ni por pedir una aclaración. Ahí poné needsHuman=true y en "reply" avisá breve que en un momento lo atiende una persona. NO inventes la respuesta. En cualquier otro caso needsHuman=false.
- humanReason: si needsHuman=true o hay un ítem con extra, completá un motivo corto para el que atienda ("extra de huevo a cobrar", "pregunta si hay tal cosa"). Si no, null.
- El campo "reply" es lo ÚNICO que se le envía al cliente. Escribilo natural y MUY BREVE: 1 o 2 oraciones como máximo, sin repetir todo el pedido en cada mensaje ni hacer listas largas.`;

// Nullable vía anyOf (la salida estructurada no acepta type:['string','null'] con enum).
const nullableEnum = (values: string[]) => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['ordering', 'confirm', 'cancel', 'other'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['pizza', 'promo', 'producto'] },
          name: { type: 'string' },
          flavors: { type: 'array', items: { type: 'string' } },
          size: nullableEnum(['SMALL', 'MEDIUM', 'LARGE']),
          quantity: { type: 'integer' },
          molde: { type: 'boolean' },
          extra: nullableString,
          notes: nullableString,
        },
        required: ['kind', 'name', 'flavors', 'size', 'quantity', 'molde', 'extra', 'notes'],
      },
    },
    deliveryType: nullableEnum(['DELIVERY', 'PICKUP']),
    address: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            street: { type: 'string' },
            number: { type: 'string' },
            apartment: nullableString,
            reference: nullableString,
          },
          required: ['street', 'number', 'apartment', 'reference'],
        },
        { type: 'null' },
      ],
    },
    paymentMethod: nullableEnum(['EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO']),
    customerName: nullableString,
    ready: { type: 'boolean' },
    needsHuman: { type: 'boolean' },
    humanReason: nullableString,
    reply: { type: 'string' },
  },
  required: ['intent', 'items', 'deliveryType', 'address', 'paymentMethod', 'customerName', 'ready', 'needsHuman', 'humanReason', 'reply'],
};

// Las instrucciones editables del local viven en la base (versionadas, editables
// desde /admin/whatsapp/bot). El .md del repo es solo la semilla inicial.

/**
 * Interpreta la conversación acumulada de un pedido y devuelve un borrador
 * estructurado + una respuesta para el cliente. Devuelve `null` si la IA no está
 * disponible o falla (el flujo entonces deriva a una persona).
 */
export async function parseOrder(
  menuText: string,
  history: ParserTurn[],
  provider: AIProvider = defaultProvider()
): Promise<ParsedDraft | null> {
  // La salida estructurada NO permite que el último mensaje sea del asistente
  // (sería un "pre-fill"). Recortamos turnos finales del bot para terminar en el
  // cliente. Si no queda ningún turno del cliente, no hay nada que interpretar.
  let turns = history;
  while (turns.length && turns[turns.length - 1].role === 'assistant') turns = turns.slice(0, -1);
  if (!turns.length) return null;

  const [instructions, corrections] = await Promise.all([getInstructions(), getCorrectionExamples()]);
  const systemText = instructions
    ? `${SYSTEM}\n\n--- INSTRUCCIONES DEL LOCAL (respetalas) ---\n${instructions}`
    : SYSTEM;

  // Prefijo estable (instrucciones + menú + correcciones): en Anthropic el corte
  // de caché va al final, así que entre mensajes del mismo pedido las llamadas
  // siguientes se cobran a precio de lectura.
  const systemBlocks = [systemText, `MENÚ:\n${menuText}`];
  if (corrections) systemBlocks.push(corrections);

  try {
    const res = await callStructured(
      { systemBlocks, turns, schema, maxTokens: 1024, role: 'parser' },
      provider
    );

    // Consumo por llamada, para comparar proveedores con datos propios.
    // `cache_read` en 0 siempre = el prefijo no llega al mínimo cacheable del
    // modelo y estamos pagando input completo cada vez.
    const u = res.usage;
    console.log(
      `[wa-parser] ${res.provider}/${res.model} in=${u.in} out=${u.out}` +
        (u.thinking !== undefined ? ` (pensó ${u.thinking})` : '') +
        ` cache_write=${u.cacheWrite} cache_read=${u.cacheRead}`
    );

    if (!res.text) return null;
    return JSON.parse(res.text) as ParsedDraft;
  } catch (e) {
    console.error('[wa-parser] error:', e instanceof Error ? e.message : e);
    return null;
  }
}
