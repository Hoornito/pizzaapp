import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrderById } from '@/services/order.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (session.user.role !== 'ADMIN' && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: order });
}
