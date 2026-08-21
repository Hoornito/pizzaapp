import jwt from 'jsonwebtoken';
import { getFcmServiceAccount, type PushPayload } from './config';

/**
 * Envío a las apps nativas (Android/iOS) por FCM HTTP v1.
 *
 * No usamos el SDK de firebase-admin: sólo hace falta firmar un JWT con la
 * service account, canjearlo por un access token y hacer un POST. Con eso
 * evitamos sumar ~10 MB de dependencias al server.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const account = getFcmServiceAccount();
  if (!account) return null;

  // Reusamos el token hasta 1 min antes de que venza (dura 1 hora).
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    account.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    console.error('[push/fcm] No se pudo obtener el access token:', res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export type FcmResult = { ok: true } | { ok: false; gone: boolean; error: string };

/**
 * Manda una notificación a un token de dispositivo. `gone: true` en el
 * resultado significa que el token ya no sirve (app desinstalada o token
 * rotado) y hay que dar de baja el dispositivo.
 */
export async function sendFcmNotification(token: string, payload: PushPayload): Promise<FcmResult> {
  const account = getFcmServiceAccount();
  const accessToken = await getAccessToken();
  if (!account || !accessToken) return { ok: false, gone: false, error: 'FCM sin configurar' };

  const message = {
    token,
    notification: { title: payload.title, body: payload.body },
    // Los data llegan como strings sí o sí; el click abre la URL del pedido.
    data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
    android: {
      priority: 'HIGH' as const,
      notification: {
        // Canal creado por la app nativa (ver docs/mobile-app.md).
        channel_id: 'pedidos',
        sound: 'default',
        ...(payload.tag ? { tag: payload.tag } : {}),
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: 'default',
          // Agrupa las notificaciones del mismo pedido en iOS.
          ...(payload.tag ? { 'thread-id': payload.tag } : {}),
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  );

  if (res.ok) return { ok: true };

  const text = await res.text();
  // UNREGISTERED (404) e INVALID_ARGUMENT sobre el token = destino muerto.
  const gone = res.status === 404 || text.includes('UNREGISTERED') || text.includes('NOT_FOUND');
  return { ok: false, gone, error: `${res.status} ${text.slice(0, 300)}` };
}
