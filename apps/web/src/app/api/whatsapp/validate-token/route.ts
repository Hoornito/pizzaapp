import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { phone: string; jti: string };

    const redisKey = `wa:token:${payload.jti}`;
    const stored = await redis.get(redisKey);
    if (!stored) {
      return NextResponse.json({ valid: false, expired: true, error: 'Token expirado o ya utilizado' });
    }

    const dbToken = await prisma.whatsAppToken.findFirst({
      where: { token, isUsed: false },
    });

    if (!dbToken) {
      return NextResponse.json({ valid: false, expired: true, error: 'Token inválido' });
    }

    return NextResponse.json({ valid: true, phone: payload.phone });
  } catch (err) {
    return NextResponse.json({ valid: false, error: 'Token inválido o expirado' });
  }
}
