import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { changePickupPaymentMethod } from '@/services/order.service';

const schema = z.object({ paymentMethod: z.enum(['EFECTIVO', 'TRANSFERENCIA']) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
  }

  try {
    const order = await changePickupPaymentMethod(id, session.user.id, parsed.data.paymentMethod);
    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cambiar el método de pago';
    const status = message === 'No autorizado' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
