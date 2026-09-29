import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff, isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { openCashRegisterSchema } from '@/lib/validators';
import { getOpenCashRegister, openCashRegister, computeExpectedCash } from '@/services/finance.service';

export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // El mostrador abre y cierra la caja desde su pantalla, pero no ve montos:
  // solo si hay caja abierta, de qué turno y si es simulación.
  if (!isAdmin(session.user.role)) {
    const open = await getOpenCashRegister();
    return NextResponse.json({
      success: true,
      data: {
        open: open ? { id: open.id, shift: open.shift, isTest: open.isTest, openedAt: open.openedAt } : null,
      },
    });
  }

  const [open, history] = await Promise.all([
    getOpenCashRegister(),
    prisma.cashRegister.findMany({ orderBy: { openedAt: 'desc' }, take: 30 }),
  ]);

  const expectedCash = open ? await computeExpectedCash(open) : null;

  return NextResponse.json({
    success: true,
    data: { open: open ? { ...open, expectedCash } : null, history },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = openCashRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  try {
    const register = await openCashRegister(parsed.data, session.user.id);
    const data = isAdmin(session.user.role) ? register : { id: register.id };
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al abrir la caja' },
      { status: 400 }
    );
  }
}
