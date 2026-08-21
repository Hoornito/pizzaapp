'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { enablePush, getPushState } from '@/lib/push-client';
import { isNativeApp } from '@/lib/native';

/**
 * Mantiene al día el registro del dispositivo para las notificaciones push.
 * Va montado global (dentro de SessionProvider) y no dibuja nada.
 *
 * Reglas:
 *  - En la web NO pide permiso solo: sólo re-registra si el cliente ya lo dio
 *    antes (el token/endpoint puede rotar). El pedido de permiso se hace desde
 *    el cartel de "Mis pedidos" o el botón del perfil.
 *  - En la app nativa sí pide permiso al primer arranque, que es lo esperable
 *    para una app de pedidos, y una sola vez por instalación.
 */
export function PushSetup() {
  const { status } = useSession();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || done.current) return;
    done.current = true;

    const openUrl = (url: string) => router.push(url);

    void (async () => {
      const state = await getPushState();

      if (state === 'granted') {
        await enablePush({ askPermission: false, onOpenUrl: openUrl });
        return;
      }

      if (isNativeApp() && state === 'default' && !localStorage.getItem('push:asked')) {
        localStorage.setItem('push:asked', '1');
        await enablePush({ askPermission: true, onOpenUrl: openUrl });
      }
    })();
  }, [status, router]);

  return null;
}
