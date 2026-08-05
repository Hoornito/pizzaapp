import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { createCorrection, listCorrections } from '@/services/wa-corrections.service';

// Lista de correcciones (por defecto solo las pendientes de destilar).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const all = req.nextUrl.searchParams.get('all') === '1';
  const data = await listCorrections({ pending: !all });
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
});
const bodySchema = z.object({
  conversationId: z.string().nullish(),
  context: z.array(turnSchema).default([]),
  badReply: z.string().default(''),
  goodReply: z.string().min(1, 'Escribí qué tendría que haber respondido.'),
  note: z.string().nullish(),
});

// Guardar una corrección desde el simulador.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }
  try {
    const created = await createCorrection({ ...parsed.data, userId: session.user.id });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar la corrección' },
      { status: 400 }
    );
  }
}
