import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * Valida el código que desbloquea las secciones sensibles del panel (dashboard,
 * reportes, finanzas, empleados) en la compu del admin. Se chequea acá y no en
 * el cliente para que el código no viaje en el JS de la página.
 */
const schema = z.object({ code: z.string().regex(/^\d{4}$/) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const rl = await rateLimit(req, { windowMs: 60_000, max: 10, keyPrefix: 'rl:sections-unlock' });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos' }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false });

  const expected = process.env.ADMIN_SECTIONS_CODE || '0808';
  return NextResponse.json({ ok: parsed.data.code === expected });
}
