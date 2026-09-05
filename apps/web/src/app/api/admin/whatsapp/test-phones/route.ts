import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { getWATestPhones, setWATestPhones } from '@/services/app-setting.service';
import { getStoreStatus } from '@/services/finance.service';

// Números a los que el bot SÍ contesta cuando hay una caja de simulación
// abierta (entrenamiento de la IA sin clientes reales en el medio).
export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const [phones, store] = await Promise.all([getWATestPhones(), getStoreStatus()]);
  return NextResponse.json(
    { success: true, phones, simulacion: store.test },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

const bodySchema = z.object({ phones: z.array(z.string().max(30)).max(20) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const phones = await setWATestPhones(parsed.data.phones);
  return NextResponse.json({ success: true, phones });
}
