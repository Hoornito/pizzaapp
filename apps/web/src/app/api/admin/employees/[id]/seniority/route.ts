import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { seniorityPayoutSchema } from '@/lib/validators';
import { addSeniorityPayout, getSeniorityPayouts } from '@/services/employee.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const payouts = await getSeniorityPayouts(id);
  return NextResponse.json({ success: true, data: payouts });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = seniorityPayoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  try {
    const payout = await addSeniorityPayout(id, parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: payout }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar' },
      { status: 400 }
    );
  }
}
