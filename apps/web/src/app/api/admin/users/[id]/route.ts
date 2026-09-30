import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteCustomerUser } from '@/services/user.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const { password: _, ...safeUser } = user as any;
  return NextResponse.json({ success: true, data: safeUser });
}

// El rol NO se cambia desde el panel: pasar a un cliente a ADMIN le daría
// acceso a todo (finanzas, empleados). Las cuentas del personal se crean aparte.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteCustomerUser(id, session.user.id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
