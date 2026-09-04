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
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'MERCADO_PAGO' | 'MIXTO' | null;
  /**
   * Pago MIXTO: cuanto va en efectivo y cuanto por transferencia. El sistema
   * valida que sumen el total; si no suman, lo revisa una persona.
   */
  cashAmount: number | null;
  transferAmount: number | null;
  customerName: string | null;
  /**
   * Efectivo: con cuanto abona el cliente (para calcular el vuelto). null si no
   * lo dijo o si no paga en efectivo.
   */
  cashReceived: number | null;
  /**
   * Si el cliente lo pide para una hora puntual, esa hora en formato "HH:MM"
   * (24 h). El sistema la convierte a fecha y lo carga como pedido programado.
   * null = lo antes posible.
   */
  scheduledFor: string | null;
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
- Trabajás SOLO con los ítems del MENÚ de abajo. Nunca inventes productos ni precios: si cotizás algo, tiene que salir tal cual del menú. El TOTAL del pedido lo calcula el sistema, no vos.
- Para cada ítem usá el nombre EXACTO como figura en el menú (para pizzas, el/los gusto/s exacto/s).
- Pizzas: preguntá tamaño (Individual/Mediana/Grande) y gusto. Aceptan mitad y mitad (2 gustos). Si el cliente no aclara el tamaño, preguntalo.
- "Al molde" es una preferencia de cocina (sin costo): marcá molde=true.
- DISTINGUÍ dos cosas muy distintas:
  • AGREGADO QUE SE COBRA → va en el campo "extra" (texto). Es sumar algo que tiene costo aparte: "extra de jamón", "agregale huevo", "doble muzzarella", "extra de queso". NO le pongas precio (lo pone una persona).
  • SUSTITUCIÓN / PREFERENCIA / QUITAR algo → NO es extra, va en "notes" y NO se cobra: "aceituna verde en vez de negra", "sin cebolla", "poca sal", "bien cocida", "cortada en cuadrados", "la salsa aparte". Ante la duda de si algo se cobra o no, tratalo como preferencia (notes), NO como extra.
- Pedí los datos que falten, de a poco: qué quiere pedir, si es envío (delivery) o retira por el local (pickup), la dirección si es delivery, y el medio de pago (efectivo, transferencia o Mercado Pago).
- PAGO MIXTO: si el cliente parte el pago entre dos medios ("te pago 10000 en efectivo y 5000 por transferencia", "una parte en efectivo y el resto transferencia"), poné paymentMethod="MIXTO" y cargá los montos en "cashAmount" (efectivo) y "transferAmount" (transferencia). Si dijo sólo una de las dos partes, preguntá la otra. Los montos tienen que sumar el total del pedido.
- EFECTIVO: cuando el cliente elige efectivo, preguntale CON CUÁNTO abona (para llevarle el vuelto). Si lo dice ("con 20 mil", "con $20.000", "justo"), cargá ese número en "cashReceived" (si dice que paga justo, dejalo en null). No insistas más de una vez: si no contesta, seguí igual con cashReceived=null.
- PRECIOS: el menú de abajo trae los precios. Si el cliente pregunta cuánto sale algo ("cuánto sale", "qué precio tiene", "cuánto es todo"), RESPONDÉ con el precio del menú en ese mismo mensaje, sin esperar a cerrar el pedido. Usá SIEMPRE los precios del menú, nunca inventes ni estimes. El TOTAL final lo calcula igual el sistema al confirmar.
- SIN STOCK: si el menú trae una sección "SIN STOCK HOY", esos productos NO se pueden pedir. Si el cliente pide uno, decíselo con naturalidad ("hoy no nos queda X") y ofrecé seguir con el resto. NO lo cargues como ítem y NO derives a una persona por eso.
- PEDIDO PROGRAMADO: si el cliente pide para una hora puntual ("para las 21", "a las 21:30", "en dos horas"), poné esa hora en "scheduledFor" con formato "HH:MM" en 24 h (ej "21:30"). Si es "lo antes posible" o no aclara, dejalo en null. Confirmale la hora en el "reply".
- DEMORA: si preguntan cuánto tarda, la demora habitual es de unos 30 minutos (puede estirarse en horario pico). Contestalo vos, no derives a una persona. Si el pedido es programado, la referencia es la hora acordada.
- CANCELAR: si el cliente dice que cancela todo o que no quiere nada ("cancelo todo", "dejalo", "no quiero nada"), poné intent="cancel", needsHuman=false y contestá amable y corto que quedó sin efecto y que cuando quiera vuelva a escribir. NO derives a una persona: cancelar es parte normal del trabajo.
- Cuando tengas TODO (pedido + entrega + pago), hacé un resumen y pedí que confirme ("¿te lo confirmo?"). Marcá ready=true. El total lo agrega el sistema al resumen.
- Cuando el cliente confirme explícitamente un pedido ya resumido, poné intent="confirm".
- Si el cliente quiere cancelar/empezar de nuevo, intent="cancel". Si escribe algo ajeno a un pedido, intent="other".
- La ciudad de envío es siempre San Vicente (no hace falta preguntarla).
- EXTRA que se cobra: cuando el cliente suma un ingrediente a un ítem ("muzza CON huevo", "con jamón", "agregale panceta", "extra de queso", "doble muzzarella"), eso es un EXTRA. Cargá ese ingrediente en el campo "extra" del ítem —si figura en la lista AGREGADOS del menú, escribilo con ESE nombre exacto— y SEGUÍ tomando el pedido con total normalidad (preguntá tamaño, entrega, pago, nombre). NO preguntes por el extra, NO avises que se cobra, NO pongas needsHuman: el sistema resuelve el precio del extra al final. Ej: "2 grandes de muzza con huevo" → 2 ítems pizza Muzzarella grandes, cada uno con extra="huevo".
- Pedir una aclaración NORMAL del menú (qué tamaño, si la empanada de carne es común/picante/a cuchillo, etc.) NO es derivar a humano: preguntalo vos en "reply" con needsHuman=false.
- DERIVAR A HUMANO (needsHuman=true): SOLO si el CLIENTE PREGUNTA algo que no podés resolver con el menú —un reclamo, negociar precios, algo raro fuera de tomar el pedido—. La disponibilidad YA NO va por acá: el menú te dice qué hay y qué no (sección SIN STOCK HOY), así que eso lo contestás vos. Nunca por un extra ni por pedir una aclaración. Ahí poné needsHuman=true y en "reply" avisá breve que en un momento lo atiende una persona. NO inventes la respuesta. En cualquier otro caso needsHuman=false.
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
    paymentMethod: nullableEnum(['EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'MIXTO']),
    cashAmount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    transferAmount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    customerName: nullableString,
    cashReceived: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    scheduledFor: nullableString,
    ready: { type: 'boolean' },
    needsHuman: { type: 'boolean' },
    humanReason: nullableString,
    reply: { type: 'string' },
  },
  required: ['intent', 'items', 'deliveryType', 'address', 'paymentMethod', 'cashAmount', 'transferAmount', 'customerName', 'cashReceived', 'scheduledFor', 'ready', 'needsHuman', 'humanReason', 'reply'],
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
