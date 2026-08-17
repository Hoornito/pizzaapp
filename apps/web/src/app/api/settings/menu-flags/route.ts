import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { getMenuFlags, saveMenuFlags } from '@/services/app-setting.service';
import { PIZZA_SIZES } from '@/types/product.types';
import { z } from 'zod';

/** Público: el menú necesita saber qué puede ofrecer. */
export async function GET() {
  return NextResponse.json(
    { success: true, data: await getMenuFlags() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

const schema = z.object({
  moldeDisabled: z.boolean().optional(),
  sizeDisabled: z
    .object(Object.fromEntries(PIZZA_SIZES.map((s) => [s, z.boolean().optional()])))
    .optional(),
});

/**
 * Lo cambia cualquiera del local (no solo el admin): el que se queda sin masa a
 * mitad del servicio es el que está atendiendo.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await saveMenuFlags(parsed.data) });
}
