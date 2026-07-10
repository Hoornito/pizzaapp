import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { parseLocalDate } from '@/services/finance.service';
import { createOrder } from '@/services/order.service';
import { getOpenCashRegister } from '@/services/finance.service';
import { createOrderSchema } from '@/lib/validators';
import { isStaff } from '@/lib/roles';
import type { OrderStatus, Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as OrderStatus | null;
  const view = searchParams.get('view'); // 'active' | 'closed'
  const date = searchParams.get('date'); // YYYY-MM-DD
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {};
  if (status) {
    where.status = status;
  } else if (view === 'active') {
    // PENDIENTE_PAGO (MercadoPago esperando acreditación) no entra a la cocina.
    where.status = { notIn: ['PENDIENTE_PAGO', 'ENTREGADO', 'CANCELADO'] };
  } else if (view === 'closed') {
    where.status = { in: ['ENTREGADO', 'CANCELADO'] };
  }
  if (date) {
    const d = parseLocalDate(date);
    where.createdAt = { gte: startOfDay(d), lte: endOfDay(d) };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        deliveryEmployee: { select: { id: true, firstName: true, lastName: true } },
        payment: { select: { status: true, paidAt: true } },
        items: {
          include: {
            product: { select: { name: true } },
            promotion: { select: { name: true } },
          },
        },
        address: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: orders,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

// Carga de un pedido desde el mostrador / admin: se confirma e imprime al instante.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = createOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  // El mostrador no usa MercadoPago (no hay redirección del cliente).
  if (parsed.data.paymentMethod === 'MERCADO_PAGO') {
    return NextResponse.json(
      { error: 'Mercado Pago no está disponible para pedidos de mostrador' },
      { status: 400 }
    );
  }

  // No se pueden tomar pedidos con la caja cerrada.
  const openRegister = await getOpenCashRegister();
  if (!openRegister) {
    return NextResponse.json(
      { error: 'La caja está cerrada. Abrí la caja en Finanzas para tomar pedidos.' },
      { status: 409 }
    );
  }

  try {
    const order = await createOrder(session.user.id, parsed.data, {
      confirmImmediately: true,
      printOnCreate: true,
    });
    return NextResponse.json({ success: true, data: order });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo cargar el pedido' },
      { status: 400 }
    );
  }
}
