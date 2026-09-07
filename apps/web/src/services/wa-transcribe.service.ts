import { downloadMedia } from '@/lib/whatsapp';
import { geminiModelFor, providerAvailable } from '@/lib/ai-provider';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Notas de voz razonables. Un audio más largo que esto casi siempre es alguien
// mandando otra cosa; lo cortamos antes de gastar tokens al pedo.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/**
 * Vocabulario del local para el transcriptor: los nombres tal cual figuran en el
 * menú, para que los escriba bien en vez de fonéticamente.
 *
 * Se arma del menú cacheado (`getWAMenu`), así que se mantiene solo cuando el
 * local carga o saca productos. Va acotado: los nombres, sin precios ni
 * descripciones, que para transcribir no aportan.
 */
async function menuVocabulary(): Promise<string> {
  try {
    const { getWAMenu } = await import('./wa-menu.service');
    const menu = await getWAMenu();
    const promos = menu.promotions.map((p) => p.name);
    const productos = menu.products.map((p) => p.name);
    const pizzas = menu.pizzas.map((p) => p.name);

    return [
      'Escribí los nombres del local TAL CUAL figuran en esta lista (respetá mayúsculas y ortografía).',
      'Las promos se escriben con número: "Promo 6", nunca "promo seis".',
      promos.length ? `PROMOS: ${promos.join(', ')}` : '',
      pizzas.length ? `GUSTOS DE PIZZA: ${pizzas.join(', ')}` : '',
      productos.length ? `OTROS: ${productos.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch {
    // Si el menú no está disponible, transcribimos igual sin vocabulario.
    return '';
  }
}

/**
 * Transcribe una nota de voz de WhatsApp.
 *
 * Va en una llamada APARTE y pelada, a propósito: sólo el audio y una consigna
 * de dos líneas. Si el audio viajara dentro de la llamada del parser, cada nota
 * de voz pagaría además los ~4k tokens de menú + instrucciones. Así se paga
 * nada más que el audio (~32 tokens por segundo).
 *
 * Devuelve null si no se puede transcribir; el llamador decide qué hacer (hoy:
 * dejar el mensaje para una persona en vez de inventar un pedido).
 */
export async function transcribeVoiceNote(mediaId: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !providerAvailable('gemini')) return null;

  let audio: { buffer: Buffer; mimeType: string };
  try {
    audio = await downloadMedia(mediaId);
  } catch (e) {
    console.error('[wa-transcribe] no se pudo bajar el audio:', e instanceof Error ? e.message : e);
    return null;
  }

  if (audio.buffer.length > MAX_AUDIO_BYTES) {
    console.warn(`[wa-transcribe] audio de ${audio.buffer.length} bytes: descartado`);
    return null;
  }

  const model = geminiModelFor('parser');
  const prompt =
    'Transcribí este audio de un cliente de una pizzería de San Vicente (Buenos Aires), ' +
    'en español rioplatense. ' +
    'Devolvé SOLO la transcripción literal, sin comillas, sin comentarios y sin agregar nada. ' +
    'Si el audio está vacío o no se entiende nada, devolvé exactamente: (inaudible)\n\n' +
    // Sin esto el modelo escribe lo que le suena ("musarela", "la promo seis",
    // "roquefor") y después el parser no encuentra el producto en el menú y le
    // contesta al cliente que no lo tenemos. Pasarle el vocabulario del local
    // cuesta unos pocos cientos de tokens por audio y es lo que hace que un
    // "cuánto está la promo 6" caiga en el ítem correcto.
    (await menuVocabulary());

  try {
    const res = await fetch(`${GEMINI_API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: audio.mimeType, data: audio.buffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 128 } },
      }),
    });

    if (!res.ok) {
      console.error('[wa-transcribe] Gemini', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    const u = data.usageMetadata ?? {};
    console.log(
      `[wa-transcribe] ${model} in=${u.promptTokenCount ?? 0} out=${u.candidatesTokenCount ?? 0} ` +
        `audio=${Math.round(audio.buffer.length / 1024)}KB -> ${text.length} chars`
    );

    if (!text || text === '(inaudible)') return null;
    return text;
  } catch (e) {
    console.error('[wa-transcribe] error:', e instanceof Error ? e.message : e);
    return null;
  }
}
