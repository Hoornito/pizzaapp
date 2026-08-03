import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { resetSimConversation } from '@/services/wa-sim.service';

const bodySchema = z.object({ phone: z.string().min(3).max(20) });

// Reinicia (borra) la conversación de prueba.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  await resetSimConversation(parsed.data.phone.trim());
  return NextResponse.json({ success: true });
}
