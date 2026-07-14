import { NextResponse } from 'next/server';
import { isStoreOpen } from '@/services/finance.service';

// Estado público de la tienda para el cliente: ¿se pueden tomar pedidos ahora?
// (Abierto = hay una caja abierta y no es de simulación.)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const open = await isStoreOpen();
    return NextResponse.json({ open });
  } catch {
    // Ante un error puntual no bloqueamos: el POST de pedidos igual valida.
    return NextResponse.json({ open: true });
  }
}
