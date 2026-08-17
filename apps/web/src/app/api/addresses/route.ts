import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
