import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { loadPostresStock } from '@/services/postres.service';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entries = Array.isArray(body?.entries) ? body.entries : null;
  if (!entries) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    const applied = await loadPostresStock(entries, session.user.id);
    return NextResponse.json({ success: true, applied });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar stock' },
      { status: 400 }
    );
  }
}
