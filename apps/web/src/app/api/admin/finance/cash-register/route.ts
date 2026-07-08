import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { openCashRegisterSchema } from '@/lib/validators';
import { getOpenCashRegister, openCashRegister, computeExpectedCash } from '@/services/finance.service';

export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
    return NextResponse.json({ success: true, data: register }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al abrir la caja' },
      { status: 400 }
    );
  }
}
