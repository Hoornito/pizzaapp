import axios from 'axios';

const WA_API_BASE = `https://graph.facebook.com/v19.0`;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const waClient = axios.create({
  baseURL: `${WA_API_BASE}/${PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export async function sendText(to: string, body: string): Promise<void> {
  await waClient.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: false },
  });
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  await waClient.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

export async function sendInteractiveList(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): Promise<void> {
  await waClient.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

export async function markAsRead(messageId: string): Promise<void> {
  await waClient.post('/messages', {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

/**
 * Descarga un archivo de media (nota de voz, imagen) que mandó un cliente.
 *
 * Son DOS pasos contra la Graph API: WhatsApp entrega un id, con el id se pide
 * una URL temporal, y recién esa URL devuelve el binario —y hay que pedirla con
 * el mismo Bearer, porque no es pública.
 */
export async function downloadMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const meta = await axios.get<{ url: string; mime_type: string }>(
    `${WA_API_BASE}/${mediaId}`,
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
  );

  const file = await axios.get<ArrayBuffer>(meta.data.url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });

  return {
    buffer: Buffer.from(file.data),
    // El mime que declara WhatsApp trae a veces el codec pegado
    // ("audio/ogg; codecs=opus"); Gemini quiere el tipo pelado.
    mimeType: (meta.data.mime_type || 'audio/ogg').split(';')[0].trim(),
  };
}
