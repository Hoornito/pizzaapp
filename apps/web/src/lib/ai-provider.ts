import { createHash } from 'node:crypto';
import { getAnthropic, WA_EDITOR_MODEL, WA_PARSER_MODEL } from '@/lib/anthropic';
import { redis } from '@/lib/redis';

/**
 * Capa fina sobre el proveedor de IA, para poder correr el bot con Claude o con
 * Gemini y comparar costo y calidad con el mismo pedido.
 *
 * A Gemini le pegamos por REST con fetch, sin SDK: sumar una dependencia npm
 * obligaría a rebuildear la imagen de producción y a tocar el volumen de
 * node_modules en dev, y para una sola llamada POST no aporta nada.
 *
 * Lo único que sabe el resto del sistema es que le pide un JSON con cierta
 * forma. Los precios NUNCA salen de acá: los calcula el sistema desde la base.
 */

export type AIProvider = 'anthropic' | 'gemini';
/** 'parser' = corre en cada mensaje (modelo barato). 'editor' = a mano (modelo bueno). */
export type AIRole = 'parser' | 'editor';

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export interface StructuredRequest {
  /** Bloques de system, en orden. En Anthropic el último lleva el corte de caché. */
  systemBlocks: string[];
  turns: Turn[];
  /** JSON Schema del borrador. Si no va, la respuesta es texto libre. */
  schema?: Record<string, unknown>;
  maxTokens: number;
  role: AIRole;
}

export interface AIUsage {
  in: number;
  /** Salida TOTAL facturable. En Gemini incluye el pensamiento (ver `thinking`). */
  out: number;
  cacheRead: number;
  cacheWrite: number;
  /** Sólo Gemini: cuánto de `out` se fue en pensar. Sirve para dimensionar el tope. */
  thinking?: number;
}

export interface StructuredResponse {
  text: string;
  provider: AIProvider;
  model: string;
  usage: AIUsage;
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Configuración ──────────────────────────────────────────────────────────

export function geminiModelFor(role: AIRole): string {
  return role === 'editor'
    ? process.env.GEMINI_EDITOR_MODEL || 'gemini-3.8-flash'
    : process.env.GEMINI_PARSER_MODEL || 'gemini-3.6-flash';
}

export function modelFor(provider: AIProvider, role: AIRole): string {
  if (provider === 'gemini') return geminiModelFor(role);
  return role === 'editor' ? WA_EDITOR_MODEL : WA_PARSER_MODEL;
}

export function providerAvailable(provider: AIProvider): boolean {
  return provider === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
}

/** Proveedor por defecto: WA_AI_PROVIDER, o el que tenga API key cargada. */
export function defaultProvider(): AIProvider {
  const configured = (process.env.WA_AI_PROVIDER || '').trim().toLowerCase();
  if (configured === 'gemini' || configured === 'anthropic') return configured;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'anthropic';
}

/** Proveedores con credenciales cargadas (para mostrar en el simulador). */
export function availableProviders(): AIProvider[] {
  return (['anthropic', 'gemini'] as AIProvider[]).filter(providerAvailable);
}

// ─── Traducción del esquema ─────────────────────────────────────────────────

const GEMINI_TYPES: Record<string, string> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  integer: 'INTEGER',
  number: 'NUMBER',
  boolean: 'BOOLEAN',
};

/**
 * Pasa el JSON Schema "sabor Anthropic" al subconjunto de OpenAPI que acepta
 * Gemini. Las dos diferencias que importan:
 *  - los nullables: `anyOf: [X, {type:'null'}]` → X con `nullable: true`
 *  - `additionalProperties` no existe: se saca
 */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const node = { ...schema };
  delete node.additionalProperties;

  // Nullable expresado como anyOf con un {type:'null'} al lado.
  const anyOf = node.anyOf as Record<string, unknown>[] | undefined;
  if (Array.isArray(anyOf)) {
    const nonNull = anyOf.filter((s) => s?.type !== 'null');
    const hasNull = anyOf.length !== nonNull.length;
    if (nonNull.length === 1) {
      const converted = toGeminiSchema(nonNull[0]);
      if (hasNull) converted.nullable = true;
      if (node.description) converted.description = node.description;
      return converted;
    }
    // anyOf real (más de una variante): Gemini lo soporta, pero sin el null.
    node.anyOf = nonNull.map(toGeminiSchema);
    if (hasNull) node.nullable = true;
  }

  if (typeof node.type === 'string') {
    const mapped = GEMINI_TYPES[node.type];
    if (mapped) node.type = mapped;
  }
  if (node.properties && typeof node.properties === 'object') {
    const props = node.properties as Record<string, Record<string, unknown>>;
    node.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (node.items && typeof node.items === 'object') {
    node.items = toGeminiSchema(node.items as Record<string, unknown>);
  }
  return node;
}

// ─── Llamada ────────────────────────────────────────────────────────────────

/**
 * Pide una respuesta (JSON con esquema, o texto libre) al proveedor indicado.
 * Lanza si el proveedor no está configurado o si la API responde con error: el
 * llamador decide si deriva a una persona.
 */
export async function callStructured(
  req: StructuredRequest,
  provider: AIProvider = defaultProvider()
): Promise<StructuredResponse> {
  return provider === 'gemini' ? callGemini(req) : callAnthropic(req);
}

async function callAnthropic(req: StructuredRequest): Promise<StructuredResponse> {
  const client = getAnthropic();
  if (!client) throw new Error('Falta ANTHROPIC_API_KEY');
  const model = modelFor('anthropic', req.role);

  // El corte de caché va en el último bloque: todo el prefijo estable
  // (instrucciones + menú + correcciones) se cobra a precio de lectura.
  const system = req.systemBlocks.map((text, i) => ({
    type: 'text' as const,
    text,
    ...(i === req.systemBlocks.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));

  const res = await client.messages.create({
    model,
    max_tokens: req.maxTokens,
    system,
    messages: req.turns.map((t) => ({ role: t.role, content: t.text })),
    ...(req.schema
      ? // Salida estructurada: garantiza JSON con el esquema del borrador.
        // (El SDK aún no tipa output_config; se pasa como propiedad adicional.)
        ({ output_config: { format: { type: 'json_schema', schema: req.schema } } } as Record<string, unknown>)
      : ({ output_config: { effort: 'medium' } } as Record<string, unknown>)),
  });

  const block = res.content.find((b: { type: string }) => b.type === 'text');
  const text = block && block.type === 'text' ? block.text : '';
  const u = res.usage;
  return {
    text,
    provider: 'anthropic',
    model,
    usage: {
      in: u.input_tokens ?? 0,
      out: u.output_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
    },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
}

/**
 * Errores transitorios de Gemini: 429 (limite de rate del plan) y 5xx
 * (sobrecarga del modelo). Con el tier gratuito saltan seguido apenas hay dos
 * clientes escribiendo a la vez, y sin reintento cada uno de esos se traduce en
 * un "te atiende una persona" que no hacia falta.
 */
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [700, 2000];

// ─── Cache de contexto ──────────────────────────────────────────────────────
// El prefijo estable (prompt del sistema + instrucciones del local + menu) son
// ~4k tokens que se pagaban ENTEROS en cada mensaje: `cache_read` venia siempre
// en 0. Lo subimos una vez a la cache de Gemini y despues cada llamada lo
// referencia por nombre, que se factura a una fraccion.
//
// La clave es un hash del contenido: si cambia el menu o las instrucciones, el
// hash cambia y se crea una cache nueva sola, sin invalidar nada a mano.
const CACHE_TTL_S = 3600;
// Por debajo del minimo del modelo, Gemini rechaza la cache. Si no llega, no
// pasa nada: se manda el systemInstruction como siempre.
const CACHE_MIN_CHARS = 4096;

async function geminiCacheName(model: string, systemBlocks: string[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const joined = systemBlocks.join('\n\n');
  if (joined.length < CACHE_MIN_CHARS) return null;

  const hash = createHash('sha256').update(`${model}\u0000${joined}`).digest('hex').slice(0, 32);
  const redisKey = `wa:ai:gcache:${model}:${hash}`;
  try {
    const hit = await redis.get(redisKey);
    if (hit) return hit;
  } catch {
    // Sin Redis no cacheamos, pero el bot sigue andando.
    return null;
  }

  try {
    const res = await fetch(`${GEMINI_API.replace('/models', '')}/cachedContents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: `models/${model}`,
        systemInstruction: { parts: systemBlocks.map((text) => ({ text })) },
        ttl: `${CACHE_TTL_S}s`,
      }),
    });
    if (!res.ok) {
      // Motivos tipicos: el modelo no soporta cache explicita, o el prefijo no
      // llega al minimo de tokens. No es fatal: se sigue sin cache.
      console.warn('[ai-provider] no se pudo crear la cache:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) return null;
    // Expiramos en Redis un poco antes que en Gemini, para no referenciar una
    // cache ya vencida y comerse un 4xx.
    await redis.setex(redisKey, CACHE_TTL_S - 120, data.name).catch(() => {});
    console.log(`[ai-provider] cache de contexto creada: ${data.name} (${joined.length} chars)`);
    return data.name;
  } catch (e) {
    console.warn('[ai-provider] error creando la cache:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function callGemini(req: StructuredRequest): Promise<StructuredResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY');
  const model = modelFor('gemini', req.role);

  // El "pensamiento" de Gemini sale del MISMO presupuesto que la respuesta: con
  // maxOutputTokens al ras, el modelo gasta el cupo pensando y el JSON vuelve
  // cortado ("Unterminated string in JSON"). Por eso lo acotamos y le SUMAMOS
  // ese margen al tope, para que `req.maxTokens` quede libre para la respuesta.
  // No se puede apagar: los modelos 3.x rechazan thinkingBudget: 0 con un 400.
  const envBudget = Number(process.env.GEMINI_THINKING_BUDGET);
  const thinkingBudget =
    Number.isFinite(envBudget) && envBudget > 0
      ? envBudget
      : req.role === 'parser'
        ? 512
        : 2048;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: req.maxTokens + thinkingBudget,
    thinkingConfig: { thinkingBudget },
  };
  if (req.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = toGeminiSchema(req.schema);
  }

  // Si el prefijo estable esta cacheado, se referencia por nombre y NO se manda
  // el systemInstruction (ya vive adentro de la cache).
  const cacheName = await geminiCacheName(model, req.systemBlocks);

  const body = {
    ...(cacheName
      ? { cachedContent: cacheName }
      : { systemInstruction: { parts: req.systemBlocks.map((text) => ({ text })) } }),
    contents: req.turns.map((t) => ({
      // Gemini llama 'model' a lo que Anthropic llama 'assistant'.
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.text }],
    })),
    generationConfig,
  };

  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${GEMINI_API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    if (!RETRY_STATUS.has(res.status) || attempt >= RETRY_DELAYS_MS.length) {
      // El cuerpo del error de Gemini dice exactamente qué campo no le gustó:
      // lo dejamos entero en el log para no adivinar.
      const detail = (await res.text().catch(() => '')).slice(0, 800);
      throw new Error(`Gemini ${res.status}: ${detail}`);
    }
    console.warn(`[ai-provider] Gemini ${res.status}, reintento ${attempt + 1}/${RETRY_DELAYS_MS.length}`);
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini bloqueó el pedido: ${data.promptFeedback.blockReason}`);
  }
  const finish = data.candidates?.[0]?.finishReason;
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  // Si cortó por tope, avisamos con el número a subir en vez de dejar que
  // reviente más adelante como un JSON.parse ilegible.
  if (finish === 'MAX_TOKENS') {
    throw new Error(
      `Gemini cortó por maxOutputTokens (${req.maxTokens + thinkingBudget}; pensó ${data.usageMetadata?.thoughtsTokenCount ?? '?'}). Subí maxTokens o GEMINI_THINKING_BUDGET.`
    );
  }

  const um = data.usageMetadata ?? {};
  return {
    text,
    provider: 'gemini',
    model,
    usage: {
      // El pensamiento se factura como salida: lo sumamos para que la
      // comparación de costo contra Claude sea pareja.
      in: um.promptTokenCount ?? 0,
      out: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
      cacheRead: um.cachedContentTokenCount ?? 0,
      cacheWrite: 0,
      thinking: um.thoughtsTokenCount ?? 0,
    },
  };
}
