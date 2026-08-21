'use client';

/**
 * Detección de "app instalada" para la PWA.
 *
 * Importa sobre todo por iOS: Safari sólo entrega notificaciones push si el
 * cliente agregó el sitio a la pantalla de inicio (iOS 16.4+). En Android /
 * Chrome el push anda igual desde el navegador común.
 */

/** true si corre como app instalada (pantalla de inicio), no en una pestaña. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS no soporta display-mode: usa esta propiedad vieja.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  // El iPad moderno se hace pasar por Mac: se lo distingue por el touch.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

/** El navegador tiene la maquinaria de Web Push. */
export function supportsWebPush(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * En iOS hay que instalar primero: sin agregar a la pantalla de inicio, Safari
 * ni siquiera expone PushManager, así que el botón de "Activar" no haría nada.
 */
export function iosNeedsInstall(): boolean {
  return isIos() && !isStandalone();
}

/**
 * Registra el service worker. Se llama en todas las visitas (no sólo al activar
 * las notificaciones): es lo que habilita la pantalla de sin conexión y lo que
 * hace que el navegador ofrezca instalar la app.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('[pwa] No se pudo registrar el service worker:', err);
    return null;
  }
}
