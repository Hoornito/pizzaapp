import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAppDiscount, getActiveAppDiscount, saveAppDiscount } from '@/services/discount.service';
import { appDiscountSchema } from '@/lib/validators';

/**
 * GET público: solo el descuento VIGENTE (para el cartel y el checkout). El
 * admin pide `?all=1` para ver también el que está apagado y poder editarlo.
 */
export async function GET(req: NextRequest) {
  const wantsAll = new URL(req.url).searchParams.get('all') === '1';
  if (!wantsAll) {
    return NextResponse.json({ success: true, data: await getActiveAppDiscount() });
  }

  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: await getAppDiscount() });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = appDiscountSchema.safeParse(body);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ');
    return NextResponse.json({ error: `Datos inválidos — ${detalle}` }, { status: 400 });
  }

  // Un descuento activo sin motivo no se puede anunciar: el cartel necesita
  // el texto y el cliente merece saber por qué le descuentan.
  if (parsed.data.active && !parsed.data.label.trim()) {
    return NextResponse.json({ error: 'Poné el motivo del descuento' }, { status: 400 });
  }

  const saved = await saveAppDiscount({ ...parsed.data, label: parsed.data.label.trim() });
  return NextResponse.json({ success: true, data: saved });
}
