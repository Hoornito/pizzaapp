import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrders, createOrder } from '@/services/order.service';
import { isStoreOpen } from '@/services/finance.service';
import { createOrderSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limiter';
import type { OrderStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as OrderStatus | null;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const userId = session.user.role === 'ADMIN' ? undefined : session.user.id;

  const result = await getOrders({ userId, status: status || undefined, page, limit });
  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, keyPrefix: 'rl:orders' });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  // La tienda debe estar abierta (caja abierta, no simulación) para tomar pedidos.
  if (!(await isStoreOpen())) {
    return NextResponse.json({ error: 'Aún estamos cerrados 🕒 Volvé en un rato.' }, { status: 409 });
  }

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await createOrder(session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo crear el pedido' },
      { status: 400 }
    );
  }
}
