import Anthropic from '@anthropic-ai/sdk';

// Modelo barato para el parser de pedidos por WhatsApp. El usuario pidió
// minimizar el gasto de IA: Haiku es el más económico y alcanza de sobra para
// interpretar un pedido a partir de texto libre contra un menú acotado.
export const WA_PARSER_MODEL = 'claude-haiku-4-5';

let cached: Anthropic | null | undefined;

/**
 * Cliente de Anthropic. Devuelve `null` si no hay ANTHROPIC_API_KEY configurada,
 * para que el resto del flujo degrade con elegancia (el bot deriva a una persona
 * en vez de romper). Se instancia una sola vez.
 */
export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new Anthropic({ apiKey }) : null;
  return cached;
}

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
