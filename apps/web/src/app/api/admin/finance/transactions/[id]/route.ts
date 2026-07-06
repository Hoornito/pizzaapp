import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteFinanceTransaction } from '@/services/finance.service';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteFinanceTransaction(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el movimiento' }, { status: 400 });
  }
}
