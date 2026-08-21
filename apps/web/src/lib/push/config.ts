/**
 * Configuración de las notificaciones push. Todo es opcional a propósito: si las
 * variables no están cargadas, el envío se convierte en un no-op y la app sigue
 * funcionando igual que siempre (mail + WhatsApp + socket).
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta relativa a abrir al tocar la notificación (ej. /pedido/abc123). */
  url?: string;
  /** Agrupa/reemplaza notificaciones del mismo pedido en vez de apilarlas. */
  tag?: string;
  data?: Record<string, string>;
};

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let cachedAccount: ServiceAccount | null | undefined;

/**
 * Credenciales de Firebase (FCM HTTP v1) para las apps nativas. Se acepta el
 * JSON de la service account tal cual o en base64 — en base64 es mucho más
 * cómodo de meter en un .env o en un secret de Docker (no tiene saltos de línea).
 */
export function getFcmServiceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;

  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return (cachedAccount = null);

  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('faltan project_id / client_email / private_key');
    }
    // En los .env la clave suele quedar con los \n escapados.
    parsed.private_key = parsed.private_key.replace(/\n/g, '\n');
    return (cachedAccount = parsed);
  } catch (err) {
    console.error('[push] FCM_SERVICE_ACCOUNT_JSON inválido:', err);
    return (cachedAccount = null);
  }
}

export function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:pedidos@pizzacambalache.com.ar',
  };
}

export function isNativePushConfigured() {
  return getFcmServiceAccount() !== null;
}

export function isWebPushConfigured() {
  return getVapidKeys() !== null;
}
