import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { callStructured, defaultProvider, providerAvailable } from '@/lib/ai-provider';
import { getInstructions, saveInstructions } from '@/services/wa-instructions.service';

/** Turno guardado como contexto de la corrección (misma forma que ParserTurn). */
export interface CorrectionTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Correcciones del operador: "esto respondió el bot / esto tendría que haber
 * respondido". Tienen dos vidas:
 *
 * 1. Mientras están PENDIENTES se le pasan al modelo como ejemplos (few-shot) en
 *    cada llamada. Efecto inmediato, sin tocar el prompt ni gastar de más.
 * 2. Al DESTILAR, una llamada al modelo grande las absorbe en el texto de las
 *    instrucciones (como reglas generales, no como casos sueltos) y quedan
 *    marcadas como aplicadas, así los ejemplos no crecen para siempre.
 */

// Tope de ejemplos que viajan en el prompt: más que esto encarece cada mensaje
// del pedido sin aportar (a esa altura conviene destilar).
const MAX_EXAMPLES = 20;
// Turnos previos que guardamos como contexto de la corrección.
const CONTEXT_TURNS = 6;

export interface CorrectionInput {
  conversationId?: string | null;
  context: CorrectionTurn[];
  badReply: string;
  goodReply: string;
  note?: string | null;
  userId?: string | null;
}

export async function createCorrection(input: CorrectionInput) {
  const goodReply = input.goodReply.trim();
  if (!goodReply) throw new Error('Escribí qué tendría que haber respondido.');
  const context = input.context.slice(-CONTEXT_TURNS);

  const created = await prisma.wABotCorrection.create({
    data: {
      conversationId: input.conversationId ?? null,
      context: context as unknown as Prisma.InputJsonValue,
      badReply: input.badReply.trim(),
      goodReply,
      note: input.note?.trim() || null,
      createdById: input.userId ?? null,
    },
  });
  examplesCache = null;
  return created;
}

export async function listCorrections(opts?: { pending?: boolean; limit?: number }) {
  return prisma.wABotCorrection.findMany({
    where: opts?.pending ? { appliedAt: null } : undefined,
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 100,
  });
}

export async function deleteCorrection(id: string) {
  await prisma.wABotCorrection.delete({ where: { id } });
  examplesCache = null;
}

export async function countPending(): Promise<number> {
  return prisma.wABotCorrection.count({ where: { appliedAt: null } });
}

// ─── Ejemplos para el prompt ────────────────────────────────────────────────

let examplesCache: { at: number; text: string } | null = null;
const TTL_MS = 20 * 1000;

function turnsToText(raw: unknown): string {
  const turns = Array.isArray(raw) ? (raw as CorrectionTurn[]) : [];
  return turns
    .map((t) => `${t.role === 'user' ? 'Cliente' : 'Vos'}: ${t.text}`)
    .join('\n');
}

/**
 * Bloque de ejemplos con las correcciones pendientes, para pegar al system
 * prompt. Devuelve '' si no hay ninguna (así el prompt no cambia y el caché de
 * Anthropic se mantiene).
 */
export async function getCorrectionExamples(force = false): Promise<string> {
  if (!force && examplesCache && Date.now() - examplesCache.at < TTL_MS) return examplesCache.text;

  const pending = await prisma.wABotCorrection.findMany({
    where: { appliedAt: null },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXAMPLES,
  });

  let text = '';
  if (pending.length) {
    const items = pending.reverse().map((c, i) => {
      const ctx = turnsToText(c.context);
      const why = c.note ? `\n   Motivo: ${c.note}` : '';
      return `${i + 1}. ${ctx ? `Conversación:\n${ctx}\n   ` : ''}✗ Respondiste: "${c.badReply}"\n   ✓ Tendrías que haber respondido algo como: "${c.goodReply}"${why}`;
    });
    text = [
      'CORRECCIONES DEL LOCAL (casos reales en los que respondiste mal).',
      'Tomá el criterio de cada una y aplicalo a situaciones parecidas; no copies el texto literal.',
      '',
      ...items,
    ].join('\n');
  }

  examplesCache = { at: Date.now(), text };
  return text;
}

// ─── Destilar ───────────────────────────────────────────────────────────────

const DISTILL_SYSTEM = `Sos el editor del archivo de instrucciones de un bot que toma pedidos por WhatsApp para una pizzería.

Te paso las INSTRUCCIONES ACTUALES (Markdown) y una lista de CORRECCIONES que hizo el dueño del local: casos reales donde el bot respondió mal, con la respuesta que él esperaba.

Tu tarea: devolver una versión NUEVA de las instrucciones que incorpore el criterio de esas correcciones.

REGLAS:
- Devolvé SOLO el Markdown de las instrucciones. Sin preámbulo, sin explicación, sin bloque de código envolvente.
- Escribí REGLAS GENERALES, no una lista de casos particulares. Si tres correcciones apuntan a lo mismo, es una sola regla.
- Respetá la estructura y los títulos que ya existen: sumá o ajustá dentro de la sección que corresponda, no reordenes el archivo.
- No borres reglas que las correcciones no contradicen.
- Mantenelo CORTO y accionable. Si una regla vieja queda cubierta por una nueva, fusionalas en vez de dejar las dos.
- Nunca pongas precios ni el menú: el sistema los saca de la base de datos.
- Está escrito en español rioplatense y en segunda persona; mantené ese tono.`;

export interface DistillResult {
  content: string;
  basedOn: number; // cuántas correcciones se usaron
  model: string; // quién la escribió, para mostrarlo al revisar
}

/**
 * Le pide al modelo grande una versión nueva de las instrucciones a partir de
 * las correcciones pendientes. NO guarda nada: devuelve la propuesta para que
 * una persona la revise y decida.
 */
export async function distillCorrections(): Promise<DistillResult> {
  const provider = defaultProvider();
  if (!providerAvailable(provider)) {
    throw new Error(
      provider === 'gemini' ? 'Falta configurar GEMINI_API_KEY.' : 'Falta configurar ANTHROPIC_API_KEY.'
    );
  }

  const pending = await prisma.wABotCorrection.findMany({
    where: { appliedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!pending.length) throw new Error('No hay correcciones pendientes para destilar.');

  const current = await getInstructions(true);
  const corrections = pending
    .map((c, i) => {
      const ctx = turnsToText(c.context);
      const why = c.note ? `\nMotivo del local: ${c.note}` : '';
      return `--- Corrección ${i + 1} ---${ctx ? `\nConversación:\n${ctx}` : ''}\nRespuesta del bot: "${c.badReply}"\nRespuesta esperada: "${c.goodReply}"${why}`;
    })
    .join('\n\n');

  // Sin esquema: acá la salida es Markdown, no JSON.
  const res = await callStructured(
    {
      systemBlocks: [DISTILL_SYSTEM],
      turns: [
        {
          role: 'user',
          text: `INSTRUCCIONES ACTUALES:\n\n${current}\n\n=====\n\nCORRECCIONES A INCORPORAR (${pending.length}):\n\n${corrections}`,
        },
      ],
      maxTokens: 16000,
      role: 'editor',
    },
    provider
  );

  // Por las dudas, sacamos un ```markdown envolvente si igual lo puso.
  const content = res.text.trim().replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '').trim();
  if (!content) throw new Error('El modelo devolvió instrucciones vacías.');

  console.log(`[wa-distill] ${res.provider}/${res.model} in=${res.usage.in} out=${res.usage.out}`);
  return { content, basedOn: pending.length, model: `${res.provider}/${res.model}` };
}

/**
 * Aplica la propuesta (posiblemente editada a mano): guarda una versión nueva y
 * marca como aplicadas las correcciones que estaban pendientes.
 */
export async function applyDistilled(content: string, userId?: string | null) {
  const pending = await prisma.wABotCorrection.findMany({
    where: { appliedAt: null },
    select: { id: true },
  });
  const version = await saveInstructions(content, {
    source: 'destilado',
    note: `Destilado de ${pending.length} correccion${pending.length === 1 ? '' : 'es'}`,
    userId,
  });
  if (pending.length) {
    await prisma.wABotCorrection.updateMany({
      where: { id: { in: pending.map((c) => c.id) } },
      data: { appliedAt: new Date(), appliedVersion: version.version },
    });
  }
  examplesCache = null;
  return { version, applied: pending.length };
}
