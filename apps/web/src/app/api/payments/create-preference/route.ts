import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrderById } from '@/services/order.service';
import { createMercadoPagoPreference } from '@/services/payment.service';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });

  const order = await getOrderById(orderId);
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  if (session.user.role !== 'ADMIN' && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const preference = await createMercadoPagoPreference(order);
  return NextResponse.json({ success: true, data: preference });
}
