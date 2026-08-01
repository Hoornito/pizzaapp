import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { setBotPaused } from '@/services/whatsapp-inbox.service';

const bodySchema = z.object({ paused: z.boolean() });

// Pausar/reanudar el bot para una conversación (takeover humano).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const convo = await setBotPaused(id, parsed.data.paused);
  return NextResponse.json({ success: true, data: { botPaused: convo.botPaused } });
}
