import webpush from 'web-push';
import { getVapidKeys, type PushPayload } from './config';

/**
 * Envío a navegadores (Web Push / VAPID). Sirve para la web de escritorio y
 * para la PWA instalada — en iOS sólo funciona si el cliente agregó la web a la
 * pantalla de inicio (Safari 16.4+), por eso la app nativa usa FCM.
 */

let configured = false;

function ensureConfigured(): boolean {
  const keys = getVapidKeys();
  if (!keys) return false;
  if (!configured) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    configured = true;
  }
  return true;
}

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type WebPushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: PushPayload
): Promise<WebPushResult> {
  if (!ensureConfigured()) return { ok: false, gone: false, error: 'VAPID sin configurar' };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 30 });
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 = el navegador dio de baja la suscripción (borró datos, desinstaló).
    return {
      ok: false,
      gone: status === 404 || status === 410,
      error: (err as Error).message,
    };
  }
}
