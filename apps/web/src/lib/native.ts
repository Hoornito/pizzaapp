'use client';

/**
 * Puente con la app nativa (Capacitor). La app envuelve el mismo sitio web, así
 * que el código es el mismo en los dos lados: acá sólo detectamos si estamos
 * corriendo adentro del contenedor nativo y accedemos a los plugins por el
 * global `window.Capacitor`.
 *
 * A propósito NO importamos los paquetes `@capacitor/*`: así el build de la web
 * no se entera de que existen y no hace falta instalarlos en apps/web.
 */

type PluginListener = { remove: () => Promise<void> };

type PushPlugin = {
  checkPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  requestPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  register(): Promise<void>;
  removeAllListeners(): Promise<void>;
  addListener(
    event: 'registration',
    cb: (token: { value: string }) => void
  ): Promise<PluginListener>;
  addListener(event: 'registrationError', cb: (err: unknown) => void): Promise<PluginListener>;
  addListener(event: 'pushNotificationReceived', cb: (n: unknown) => void): Promise<PluginListener>;
  addListener(
    event: 'pushNotificationActionPerformed',
    cb: (action: { notification: { data?: Record<string, string> } }) => void
  ): Promise<PluginListener>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { PushNotifications?: PushPlugin; [key: string]: unknown };
};

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** true sólo adentro de la app de Android/iOS. En la web siempre false. */
export function isNativeApp(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.());
}

/** 'android' | 'ios' | 'web' */
export function nativePlatform(): string {
  return getCapacitor()?.getPlatform?.() ?? 'web';
}

export function getPushPlugin(): PushPlugin | null {
  return getCapacitor()?.Plugins?.PushNotifications ?? null;
}
