import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { withdrawPostres } from '@/services/postres.service';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === 'string' ? body.reason : '';

  try {
    const txn = await withdrawPostres(amount, reason, session.user.id);
    return NextResponse.json({ success: true, data: txn });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar el retiro' },
      { status: 400 }
    );
  }
}
