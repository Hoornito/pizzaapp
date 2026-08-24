'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { enablePush, getPushState, pushOptedOut } from '@/lib/push-client';
import { isNativeApp } from '@/lib/native';
import { isStaff } from '@/lib/roles';

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || done.current) return;
    // Mostrador y admin no reciben avisos de pedido: su cuenta carga pedidos de
    // otra gente y les llegaría uno por cada pedido que toman.
    if (isStaff(session?.user?.role)) return;
    done.current = true;

    const openUrl = (url: string) => router.push(url);

    void (async () => {
      // Si los apagó a propósito, no lo volvemos a suscribir a sus espaldas.
      // Esto era lo que hacía que "desactivar" no sobreviviera a un refresh.
      if (pushOptedOut()) return;

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
  }, [status, session, router]);

  return null;
}
