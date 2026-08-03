import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { editOrder } from '@/services/whatsapp-inbox.service';

const itemSchema = z.object({
  productId: z.string().nullish(),
  promotionId: z.string().nullish(),
  label: z.string(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  extra: z.string().nullish(),
  extraPrice: z.coerce.number().min(0).optional(),
  notes: z.string().nullish(),
});
const bodySchema = z.object({ items: z.array(itemSchema).min(1) });

// Edición manual del pedido armado (agregar/quitar ítems, precio del extra, aclaraciones).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  try {
    const view = await editOrder(id, parsed.data.items);
    return NextResponse.json({
      success: true,
      data: view.messages,
      flow: view.flow,
      readyOrder: view.readyOrder,
      addonOf: view.addonOf,
      humanReason: view.humanReason,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo editar el pedido' },
      { status: 400 }
    );
  }
}
