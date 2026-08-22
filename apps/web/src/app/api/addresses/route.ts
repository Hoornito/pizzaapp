import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { orderAddressSchema } from '@/lib/validators';

/**
 * Direcciones guardadas del cliente, para elegir en el checkout sin volver a
 * escribirlas. Solo las que pidió guardar: cada pedido con envío crea una fila
 * (el ticket la necesita), y ofrecerle todas sería un despelote.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rows = await prisma.address.findMany({
    where: { userId: session.user.id, saved: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Una misma dirección puede haberse guardado más de una vez: mostramos la más
  // reciente de cada una.
  const vistas = new Set<string>();
  const data = rows.filter((a) => {
    const clave = `${a.street}|${a.number}|${a.apartment ?? ''}`.toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Alta de una dirección desde "Mi perfil". Nace con `saved: true` — es una
 * dirección que el cliente quiere tener a mano, a diferencia de las que crea un
 * pedido puntual.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const parsed = orderAddressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }

  const { street, number, apartment, city, state, reference } = parsed.data;

  // Si ya la tenía guardada, no duplicamos: alcanza con volver a ofrecerla.
  const existente = await prisma.address.findFirst({
    where: {
      userId: session.user.id,
      street: { equals: street, mode: 'insensitive' },
      number: { equals: number, mode: 'insensitive' },
      apartment: apartment ? { equals: apartment, mode: 'insensitive' } : null,
    },
  });

  const data = {
    street,
    number,
    apartment: apartment || null,
    city,
    state: state || '',
    reference: reference || null,
    saved: true,
  };

  const address = existente
    ? await prisma.address.update({ where: { id: existente.id }, data })
    : await prisma.address.create({ data: { ...data, userId: session.user.id } });

  return NextResponse.json({ success: true, data: address });
}
