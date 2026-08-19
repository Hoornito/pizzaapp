import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDeliveryAreas, createDeliveryArea } from '@/services/delivery-area.service';
import { deliveryAreaSchema } from '@/lib/validators';

/** Público: el checkout avisa antes de que el cliente cargue todo. */
export async function GET() {
  return NextResponse.json(
    { success: true, data: await getDeliveryAreas() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = deliveryAreaSchema.safeParse(await req.json());
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ');
    return NextResponse.json({ error: `Datos inválidos — ${detalle}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await createDeliveryArea(parsed.data) }, { status: 201 });
}
