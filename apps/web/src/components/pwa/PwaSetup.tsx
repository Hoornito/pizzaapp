'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';

/**
 * Registra el service worker en toda visita, esté logueado el cliente o no.
 * Es lo que habilita la pantalla de sin conexión, el botón de "Instalar" del
 * navegador y la recepción de push. No dibuja nada.
 */
export function PwaSetup() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}
