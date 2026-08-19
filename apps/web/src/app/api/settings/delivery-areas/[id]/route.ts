import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateDeliveryArea, deleteDeliveryArea } from '@/services/delivery-area.service';
import { deliveryAreaSchema } from '@/lib/validators';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = deliveryAreaSchema.safeParse(await req.json());
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ');
    return NextResponse.json({ error: `Datos inválidos — ${detalle}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await updateDeliveryArea(id, parsed.data) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  await deleteDeliveryArea(id);
  return NextResponse.json({ success: true });
}
