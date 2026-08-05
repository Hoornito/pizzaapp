import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { updateOrderStatus } from '@/services/order.service';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['PENDIENTE_PAGO', 'RECIBIDO', 'CONFIRMADO', 'PREPARANDO', 'EN_HORNO', 'LISTO', 'EN_REPARTO', 'ENTREGADO', 'CANCELADO']),
  // Tiempo estimado que carga el local a mano. OJO: si no se declara acá, zod lo
  // descarta del body y nunca llega al servicio (el pedido se guardaba sin ETA).
  estimatedTime: z.coerce.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const order = await updateOrderStatus(id, parsed.data, session.user.id);
  return NextResponse.json({ success: true, data: order });
}
