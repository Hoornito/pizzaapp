import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { loadStockBulk } from '@/services/product.service';

const bodySchema = z.object({
  categoryId: z.string().min(1),
  entries: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .min(1),
});

// Carga de stock de varios productos de una categoría de una sola vez.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    const applied = await loadStockBulk(parsed.data.categoryId, parsed.data.entries, session.user.id);
    return NextResponse.json({ success: true, applied });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar stock' },
      { status: 400 }
    );
  }
}
