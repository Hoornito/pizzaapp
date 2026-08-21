'use client';

import { isNativeApp, nativePlatform, getPushPlugin } from '@/lib/native';
import { registerServiceWorker } from '@/lib/pwa';

/**
 * Alta del dispositivo en el server, del lado del cliente.
 * En la app nativa se usa el token de FCM; en el navegador, Web Push (VAPID).
 */

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

const REGISTERED_KEY = 'push:registered';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normal);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function postDevice(body: unknown): Promise<boolean> {
  const res = await fetch('/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** Config del server: si no hay claves cargadas, ni pedimos permiso. */
export async function getPushConfig(): Promise<{
  web: boolean;
  native: boolean;
  vapidPublicKey: string | null;
}> {
  const res = await fetch('/api/push/register', { cache: 'no-store' });
  if (!res.ok) return { web: false, native: false, vapidPublicKey: null };
  const json = await res.json();
  return json.data;
}

export function webPushState(): PushState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PushState;
}

/** Estado que ve la UI, unificando app nativa y navegador. */
export async function getPushState(): Promise<PushState> {
  if (isNativeApp()) {
    const plugin = getPushPlugin();
    if (!plugin) return 'unsupported';
    const { receive } = await plugin.checkPermissions();
    return receive === 'prompt' ? 'default' : (receive as PushState);
  }
  return webPushState();
}

// ─── Navegador (Web Push) ────────────────────────────────────────────────────

async function registerWeb(askPermission: boolean): Promise<boolean> {
  if (webPushState() === 'unsupported') return false;

  const config = await getPushConfig();
  if (!config.web || !config.vapidPublicKey) return false;

  let permission = Notification.permission;
  if (permission === 'default' && askPermission) permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await registerServiceWorker();
  if (!registration) return false;
  await navigator.serviceWorker.ready;

  // Si ya había una suscripción la reusamos; el server hace upsert por endpoint.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  return postDevice({
    platform: 'WEB',
    subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
  });
}

// ─── App nativa (FCM vía Capacitor) ──────────────────────────────────────────

let nativeListenersReady = false;

async function registerNative(
  askPermission: boolean,
  onOpenUrl?: (url: string) => void
): Promise<boolean> {
  const plugin = getPushPlugin();
  if (!plugin) return false;

  let { receive } = await plugin.checkPermissions();
  if (receive === 'prompt' && askPermission) {
    receive = (await plugin.requestPermissions()).receive;
  }
  if (receive !== 'granted') return false;

  if (!nativeListenersReady) {
    nativeListenersReady = true;

    // El token de FCM llega asincrónico después de register().
    await plugin.addListener('registration', (token) => {
      const platform = nativePlatform() === 'ios' ? 'IOS' : 'ANDROID';
      void postDevice({ platform, token: token.value }).then((ok) => {
        if (ok) localStorage.setItem(REGISTERED_KEY, token.value);
      });
    });

    await plugin.addListener('registrationError', (err) => {
      console.error('[push] Error registrando el dispositivo:', err);
    });

    // Tocar la notificación abre el pedido.
    await plugin.addListener('pushNotificationActionPerformed', (action) => {
      const url = action?.notification?.data?.url;
      if (url && onOpenUrl) onOpenUrl(url);
    });
  }

  await plugin.register();
  return true;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Da de alta el dispositivo. `askPermission: false` sólo re-registra si el
 * permiso ya estaba dado (para no tirarle el diálogo al cliente de la nada).
 */
export async function enablePush(
  options: { askPermission?: boolean; onOpenUrl?: (url: string) => void } = {}
): Promise<boolean> {
  const { askPermission = true, onOpenUrl } = options;
  try {
    return isNativeApp()
      ? await registerNative(askPermission, onOpenUrl)
      : await registerWeb(askPermission);
  } catch (err) {
    console.error('[push] No se pudo activar las notificaciones:', err);
    return false;
  }
}

/** Baja del dispositivo actual (el usuario apagó las notificaciones). */
export async function disablePush(): Promise<void> {
  try {
    if (isNativeApp()) {
      const token = localStorage.getItem(REGISTERED_KEY);
      if (token) {
        await fetch('/api/push/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        localStorage.removeItem(REGISTERED_KEY);
      }
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch('/api/push/unregister', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch (err) {
    console.error('[push] No se pudo desactivar las notificaciones:', err);
  }
}
