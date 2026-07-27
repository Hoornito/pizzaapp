import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { changeOrderPaymentMethod } from '@/services/order.service';

const bodySchema = z.object({
  method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO']),
  cashAmount: z.coerce.number().min(0).optional(),
  transferAmount: z.coerce.number().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }

  try {
    const order = await changeOrderPaymentMethod(id, parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: order });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cambiar el método de pago' },
      { status: 400 }
    );
  }
}
