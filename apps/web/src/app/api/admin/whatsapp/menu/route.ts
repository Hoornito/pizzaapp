import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { toNumber } from '@/lib/utils';
import { getWAMenu } from '@/services/wa-menu.service';

// Catálogo plano (productos no-pizza + promos) para el picker del botón "Editar".
// Las pizzas se arman por la IA; acá van los agregados típicos (bebidas, empanadas,
// postres, promos).
export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const menu = await getWAMenu();
  const products = menu.products.map((p) => ({
    id: p.id,
    kind: 'product' as const,
    name: p.name,
    price: toNumber(p.price),
    category: p.category?.name ?? '',
  }));
  const promotions = menu.promotions.map((p) => ({
    id: p.id,
    kind: 'promo' as const,
    name: p.name,
    price: p.price,
    category: 'Promociones',
  }));
  return NextResponse.json(
    { success: true, data: [...products, ...promotions] },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
