import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPromotions, createPromotion } from '@/services/promotion.service';
import { promotionSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const available = searchParams.get('available');
  const promotions = await getPromotions({
    available: available !== null ? available === 'true' : undefined,
  });
  return NextResponse.json({ success: true, data: promotions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  const promotion = await createPromotion(parsed.data);
  return NextResponse.json({ success: true, data: promotion }, { status: 201 });
}
