import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { takeAddon } from '@/services/whatsapp-inbox.service';

// "Tomar agregado": crea el pedido vinculado (#original-N) con lo nuevo y lo manda a Pedidos.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const res = await takeAddon(id, session.user.id);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo tomar el agregado' },
      { status: 400 }
    );
  }
}
