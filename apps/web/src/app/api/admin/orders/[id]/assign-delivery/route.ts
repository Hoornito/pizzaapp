import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assignDeliveryEmployee } from '@/services/order.service';
import { z } from 'zod';

const schema = z.object({ employeeId: z.string().min(1) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Repartidor inválido' }, { status: 400 });
  }

  try {
    const order = await assignDeliveryEmployee(id, parsed.data.employeeId, session.user.id);
    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al asignar repartidor';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
