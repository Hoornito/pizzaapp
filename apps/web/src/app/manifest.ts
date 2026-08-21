import type { MetadataRoute } from 'next';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';

/**
 * Manifest de la PWA. Habilita "Agregar a pantalla de inicio" en el celular y
 * es el mismo manifest que consume Bubblewrap si algún día publicamos la web
 * como TWA en Google Play.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidad estable de la app instalada: si cambia, el navegador la trata
    // como una app distinta y el cliente termina con dos íconos.
    id: '/',
    name: APP_NAME,
    short_name: 'Cambalache',
    description: APP_DESCRIPTION,
    // Arranca en el menú: '/' redirige ahí igual (ver next.config.ts).
    start_url: '/menu',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Nunca ofrecemos "mejor instalá la de la tienda": la PWA es la app.
    prefer_related_applications: false,
    background_color: '#FBF3E2',
    theme_color: '#C62828',
    lang: 'es-AR',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ver el menú', url: '/menu' },
      { name: 'Mis pedidos', url: '/orders' },
    ],
  };
}
