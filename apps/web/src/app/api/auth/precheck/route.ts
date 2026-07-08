import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * Pre-verificación del login en dos pasos: valida email + contraseña SIN iniciar
 * sesión, y avisa si el usuario es ADMIN y necesita el código de 4 dígitos.
 * El login real (con el código) se completa después vía signIn('credentials').
 */
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 20, keyPrefix: 'rl:precheck' });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos' }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.password) return NextResponse.json({ ok: false });

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) return NextResponse.json({ ok: false });

  const needsCode = user.role === 'ADMIN' && !!process.env.ADMIN_LOGIN_CODE;
  return NextResponse.json({ ok: true, needsCode });
}
