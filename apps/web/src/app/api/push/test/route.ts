import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendPushToUser } from '@/services/push.service';

/**
 * Manda un push de prueba a los dispositivos del usuario logueado. Sirve para
 * verificar la configuración (VAPID / FCM) sin tener que mover un pedido real.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { enviados } = await sendPushToUser(session.user.id, {
    title: '🍕 Prueba de notificaciones',
    body: 'Si ves esto, las notificaciones están funcionando.',
    url: '/orders',
    tag: 'test',
  });

  return NextResponse.json({ success: true, data: { enviados } });
}
