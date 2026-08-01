import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { replyToConversation } from '@/services/whatsapp-inbox.service';

const bodySchema = z.object({ text: z.string().min(1).max(4096) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribí un mensaje' }, { status: 400 });
  }
  try {
    const res = await replyToConversation(id, parsed.data.text, session.user.id);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al responder' },
      { status: 400 }
    );
  }
}
