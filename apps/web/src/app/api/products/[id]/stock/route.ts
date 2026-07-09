import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { adjustStock, getStockMovements } from '@/services/product.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const movements = await getStockMovements(id);
  return NextResponse.json({ success: true, data: movements });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const kind = body?.kind;
  const quantity = Number(body?.quantity);
  const note = body?.note ? String(body.note) : null;

  if (kind !== 'ENTRADA' && kind !== 'SALIDA') {
    return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
  }

  try {
    const product = await adjustStock(id, kind, quantity, note, session.user.id);
    return NextResponse.json({ success: true, data: product });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al ajustar el stock' },
      { status: 400 }
    );
  }
}
