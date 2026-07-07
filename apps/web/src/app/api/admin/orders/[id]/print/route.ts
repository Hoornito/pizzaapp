import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { emitPrintOrder } from '@/lib/socket-server';

/**
 * Reenvía un pedido a la estación de impresión (cocina + comanda por QZ Tray).
 * Es el "Reimprimir" manual: usa el mismo canal que la impresión automática al
 * confirmar, así siempre sale por QZ y no por el navegador.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  emitPrintOrder(id);
  return NextResponse.json({ success: true });
}
