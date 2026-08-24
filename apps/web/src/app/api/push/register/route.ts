import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { registerPushDevice } from '@/services/push.service';
import { isNativePushConfigured, isWebPushConfigured } from '@/lib/push/config';

/**
 * Alta del dispositivo para recibir push del estado del pedido.
 * La app nativa manda `token` (FCM); el navegador manda `subscription` (VAPID).
 */
const schema = z.object({
  platform: z.enum(['WEB', 'ANDROID', 'IOS']),
  token: z.string().min(10).optional(),
  subscription: z
    .object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    })
    .optional(),
});

export async function GET() {
  // El cliente lo usa para no pedir permiso de notificaciones si el server
  // todavía no puede mandarlas.
  return NextResponse.json(
    {
      success: true,
      data: {
        web: isWebPushConfigured(),
        native: isNativePushConfigured(),
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Los avisos de pedido son para el cliente. Mostrador y admin siguen el
  // movimiento desde el panel, y su cuenta carga pedidos de OTRA gente: si se
  // suscribieran, recibirían un aviso por cada pedido que toman.
  if (session.user.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Las notificaciones de pedido son solo para clientes.' },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    const device = await registerPushDevice({
      userId: session.user.id,
      platform: parsed.data.platform,
      token: parsed.data.token,
      subscription: parsed.data.subscription,
      userAgent: req.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true, data: { id: device.id } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
