import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { getFinanceSummary } from '@/services/finance.service';

export async function GET() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Finanzas muestra el turno actual (caja abierta). El día completo está en Reportes.
  const data = await getFinanceSummary();
  return NextResponse.json({ success: true, data });
}
