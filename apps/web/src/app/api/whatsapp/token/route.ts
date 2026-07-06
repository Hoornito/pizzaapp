import { NextRequest, NextResponse } from 'next/server';
import { validatePurchaseToken, markTokenAsUsed } from '@/services/whatsapp.service';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 20, keyPrefix: 'rl:wa-token' });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const result = await validatePurchaseToken(token);
  if (!result) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 });

  // Find or create user by phone
  let user = await prisma.user.findUnique({ where: { phone: result.phone } });

  if (!user) {
    user = await prisma.user.create({
      data: { phone: result.phone, role: 'CUSTOMER', name: `Cliente WA ${result.phone.slice(-4)}` },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      phone: result.phone,
      userId: user.id,
      userName: user.name,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (token) await markTokenAsUsed(token);
  return NextResponse.json({ success: true });
}
