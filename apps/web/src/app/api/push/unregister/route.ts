import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { unregisterPushDevice } from '@/services/push.service';

/** Baja del dispositivo: el usuario apagó las notificaciones o cerró sesión. */
const schema = z.object({
  token: z.string().optional(),
  endpoint: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  await unregisterPushDevice(parsed.data);
  return NextResponse.json({ success: true });
}
