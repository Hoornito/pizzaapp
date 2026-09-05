import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStoreStatus } from '@/services/finance.service';

// Estado público de la tienda para el cliente: ¿se pueden tomar pedidos ahora?
// (Abierto = hay una caja abierta y no es de simulación.)
//
// Con una caja de SIMULACIÓN abierta la tienda sigue cerrada para el público
// —un pedido real se borraría al cerrar el entrenamiento— pero el staff puede
// pedir desde la web como un cliente más para probar el circuito completo.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { open, test } = await getStoreStatus();
    if (open) return NextResponse.json({ open: true, test: false });

    if (test) {
      const session = await auth();
      const staff = session?.user.role === 'ADMIN' || session?.user.role === 'MOSTRADOR';
      return NextResponse.json({ open: staff, test: true });
    }
    return NextResponse.json({ open: false, test: false });
  } catch {
    // Ante un error puntual no bloqueamos: el POST de pedidos igual valida.
    return NextResponse.json({ open: true });
  }
}
