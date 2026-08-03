import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { takeOrder } from '@/services/whatsapp-inbox.service';

// "Tomar pedido": una persona confirma el pedido armado por la IA y lo manda a Pedidos.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const res = await takeOrder(id, session.user.id);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo tomar el pedido' },
      { status: 400 }
    );
  }
}
