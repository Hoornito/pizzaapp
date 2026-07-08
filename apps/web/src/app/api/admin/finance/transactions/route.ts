import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { financeTransactionSchema } from '@/lib/validators';
import { createFinanceTransaction, parseLocalDate } from '@/services/finance.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const where = dateStr
    ? { createdAt: { gte: startOfDay(parseLocalDate(dateStr)), lte: endOfDay(parseLocalDate(dateStr)) } }
    : {};

  const transactions = await prisma.financeTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ success: true, data: transactions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = financeTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  try {
    const txn = await createFinanceTransaction(parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: txn }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar el movimiento' },
      { status: 400 }
    );
  }
}
