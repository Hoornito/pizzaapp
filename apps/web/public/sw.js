/* Service worker de Pizzería Cambalache.
 *
 * Hace dos cosas: notificaciones push, y una pantalla de "sin conexión".
 *
 * A propósito NO cachea la app: es SSR y un cache mal invalidado deja al cliente
 * viendo precios o un menú viejos. Lo único que se guarda es /offline.html, que
 * es estático y nunca queda desactualizado. De paso, tener un handler de `fetch`
 * es lo que le pide Chrome para ofrecer el botón de "Instalar".
 */

const CACHE = 'cambalache-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpia versiones viejas del cache de offline.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Sólo intervenimos en la navegación entre páginas: las llamadas a la API y
  // los assets van directo a la red, sin pasar por acá.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Pizzería Cambalache', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Pizzería Cambalache';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Mismo tag = el aviso nuevo del pedido reemplaza al anterior.
    tag: payload.tag || 'pizzacambalache',
    renotify: true,
    data: { url: payload.url || '/orders', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/orders', self.location.origin);

  // Si ya hay una pestaña de la app abierta, la reusamos en vez de abrir otra.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
