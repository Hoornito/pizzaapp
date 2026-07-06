import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cancelPendingPaymentOrder } from '@/services/order.service';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  try {
    const order = await cancelPendingPaymentOrder(id, session.user.id);
    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cancelar';
    const status = message === 'No autorizado' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
