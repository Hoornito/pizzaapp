import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Deja de ofrecer una dirección guardada (no se borra: hay pedidos que la usan). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const address = await prisma.address.findUnique({ where: { id }, select: { userId: true } });
  if (!address) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  if (address.userId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  await prisma.address.update({ where: { id }, data: { saved: false } });
  return NextResponse.json({ success: true });
}
