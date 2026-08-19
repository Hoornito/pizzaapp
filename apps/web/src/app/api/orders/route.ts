import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrders, createOrder } from '@/services/order.service';
import { isStoreOpen } from '@/services/finance.service';
import { isWithinBusinessHours, todayHoursLabel } from '@/services/schedule.service';
import { findBlockedArea } from '@/services/delivery-area.service';
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

/** Calle de una dirección ya guardada (el cliente eligió una de la lista). */
async function calleDeAddressId(addressId?: string): Promise<string | null> {
  if (!addressId) return null;
  const a = await prisma.address.findUnique({ where: { id: addressId }, select: { street: true } });
  return a?.street ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, keyPrefix: 'rl:orders' });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  // Dos condiciones para tomar un pedido por la app: estar dentro del horario
  // de atención (Configuración → Horarios) y tener la caja abierta.
  if (!(await isWithinBusinessHours())) {
    const horario = await todayHoursLabel();
    return NextResponse.json(
      {
        error: horario
          ? `Estamos cerrados 🕒 Hoy atendemos de ${horario}.`
          : 'Estamos cerrados 🕒 Hoy no estamos atendiendo.',
      },
      { status: 409 }
    );
  }
  if (!(await isStoreOpen())) {
    return NextResponse.json({ error: 'Aún estamos cerrados 🕒 Volvé en un rato.' }, { status: 409 });
  }

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  // Sin teléfono no se puede coordinar la entrega. Los que se registran con
  // mail ya lo cargan; los que entran con Google no, así que lo pedimos acá y
  // lo guardamos en la cuenta para no volver a preguntarlo.
  const phone = (parsed.data.phone ?? '').trim();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  if (!user?.phone && !phone) {
    return NextResponse.json(
      { error: 'Necesitamos un teléfono de contacto para poder coordinar tu pedido.' },
      { status: 400 }
    );
  }
  if (!user?.phone && phone) {
    // Puede chocar con el teléfono de otra cuenta (es único): si pasa, seguimos
    // igual — el número queda en el pedido, que es lo que importa para entregarlo.
    await prisma.user.update({ where: { id: session.user.id }, data: { phone } }).catch(() => null);
  }

  // Barrios a los que no se llega en ciertas franjas (Configuración → Zonas de
  // reparto). Se mide contra la hora de entrega: si lo programó para la noche,
  // que el mediodía esté bloqueado no importa.
  if (parsed.data.deliveryType === 'DELIVERY') {
    const calle = parsed.data.address?.street ?? (await calleDeAddressId(parsed.data.addressId));
    const cuando = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : new Date();
    const bloqueado = calle ? await findBlockedArea(calle, cuando) : null;
    if (bloqueado) {
      return NextResponse.json(
        {
          error: `A ${bloqueado.name} no llegamos entre las ${bloqueado.blockedFrom} y las ${bloqueado.blockedTo}. Programalo para más tarde o elegí retiro en el local.`,
        },
        { status: 409 }
      );
    }
  }

  try {
    const order = await createOrder(session.user.id, parsed.data, {
      // El descuento de la app es solo para clientes: los pedidos que toma el
      // local (admin/mostrador) se cargan a precio de lista.
      applyAppDiscount: session.user.role === 'CUSTOMER',
    });
    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo crear el pedido' },
      { status: 400 }
    );
  }
}
