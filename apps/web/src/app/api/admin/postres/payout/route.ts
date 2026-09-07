import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { listPostrePayoutRates, savePostrePayoutRates } from '@/services/postre-payout.service';

const bodySchema = z.object({
  GRANDE: z.coerce.number().min(0).optional(),
  CHICO: z.coerce.number().min(0).optional(),
});

/** Historial de tarifas, para ver desde cuándo rige cada valor. */
export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const data = await listPostrePayoutRates();
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Guarda el pago por postre. NO pisa las tarifas anteriores: crea una nueva que
 * rige de ahora en adelante, así el histórico se sigue pagando con la que
 * correspondía en su momento.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    await savePostrePayoutRates(parsed.data, session.user.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar el pago' },
      { status: 400 }
    );
  }
}
