import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMenuCardImages, saveMenuCardImages } from '@/services/menu-card.service';
import { MENU_CARD_KEYS } from '@/lib/constants';
import { z } from 'zod';

/** Público: el menú del cliente necesita estas fotos para dibujarse. */
export async function GET() {
  return NextResponse.json({ success: true, data: await getMenuCardImages() });
}

const schema = z.object(
  Object.fromEntries(MENU_CARD_KEYS.map((k) => [k, z.string().optional()]))
);

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ');
    return NextResponse.json({ error: `Datos inválidos — ${detalle}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await saveMenuCardImages(parsed.data) });
}
