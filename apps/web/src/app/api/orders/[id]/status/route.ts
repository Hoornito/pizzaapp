import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateOrderStatus } from '@/services/order.service';
import { updateOrderStatusSchema } from '@/lib/validators';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Estado inválido', details: parsed.error.flatten() }, { status: 400 });
  }

  const order = await updateOrderStatus(id, parsed.data, session.user.id);
  return NextResponse.json({ success: true, data: order });
}
