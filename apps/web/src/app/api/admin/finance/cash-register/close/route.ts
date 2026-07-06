import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { closeCashRegisterSchema } from '@/lib/validators';
import { closeCashRegister } from '@/services/finance.service';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = closeCashRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  try {
    const register = await closeCashRegister(parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: register });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cerrar la caja' },
      { status: 400 }
    );
  }
}
