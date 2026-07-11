import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { markOrderPaid } from '@/services/order.service';

const bodySchema = z
  .object({
    method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO']).optional(),
    cashAmount: z.coerce.number().min(0).optional(),
    transferAmount: z.coerce.number().min(0).optional(),
  })
  .optional();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => undefined));
  const details = parsed.success ? parsed.data : undefined;
  try {
    const order = await markOrderPaid(id, session.user.id, details);
    return NextResponse.json({ success: true, data: order });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al marcar como pagado' },
      { status: 400 }
    );
  }
}
