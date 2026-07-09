import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { adjustStock } from './product.service';
import { format } from 'date-fns';

const POSTRES_SLUG = 'postres';

async function getPostresCategoryId(): Promise<string | null> {
  const cat = await prisma.category.findUnique({ where: { slug: POSTRES_SLUG } });
  return cat?.id ?? null;
}

export interface PostreProductRow {
  id: string;
  name: string;
  price: number;
  stock: number;
  available: boolean;
}

export interface PostreVentaDia {
  date: string; // YYYY-MM-DD
  cantidad: number;
  total: number;
}

/**
 * Panel de Postres: productos (stock/precio/activo), ventas diarias, totales y
 * "dinero a favor" (ingresos por postres − retiros registrados).
 */
export async function getPostresData() {
  const catId = await getPostresCategoryId();
  if (!catId) {
    return {
      products: [] as PostreProductRow[],
      ventasDiarias: [] as PostreVentaDia[],
      totalVendidos: 0,
      totalIngresos: 0,
      totalRetiros: 0,
      dineroAFavor: 0,
    };
  }

  const [products, orders, retiros] = await Promise.all([
    prisma.product.findMany({ where: { categoryId: catId }, orderBy: { name: 'asc' } }),
    // Ventas cobradas (no canceladas) que incluyen algún postre.
    prisma.order.findMany({
      where: {
        status: { not: 'CANCELADO' },
        payment: { status: 'APPROVED' },
        items: { some: { product: { categoryId: catId } } },
      },
      select: {
        createdAt: true,
        payment: { select: { paidAt: true } },
        items: {
          where: { product: { categoryId: catId } },
          select: { quantity: true, subtotal: true },
        },
      },
    }),
    prisma.postreWithdrawal.findMany({ select: { amount: true } }),
  ]);

  // Agregado por día (fecha de cobro) + totales acumulados.
  const dayMap = new Map<string, { cantidad: number; total: number }>();
  let totalVendidos = 0;
  let totalIngresos = 0;
  for (const o of orders) {
    const day = format(o.payment?.paidAt ?? o.createdAt, 'yyyy-MM-dd');
    const entry = dayMap.get(day) ?? { cantidad: 0, total: 0 };
    for (const it of o.items) {
      entry.cantidad += it.quantity;
      entry.total += toNumber(it.subtotal);
      totalVendidos += it.quantity;
      totalIngresos += toNumber(it.subtotal);
    }
    dayMap.set(day, entry);
  }

  const ventasDiarias: PostreVentaDia[] = [...dayMap.entries()]
    .map(([date, v]) => ({ date, cantidad: v.cantidad, total: v.total }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // más reciente primero

  const totalRetiros = retiros.reduce((s, r) => s + toNumber(r.amount), 0);
  const dineroAFavor = totalIngresos - totalRetiros;

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: toNumber(p.price),
      stock: p.stock,
      available: p.available,
    })),
    ventasDiarias,
    totalVendidos,
    totalIngresos,
    totalRetiros,
    dineroAFavor,
  };
}

/**
 * Carga masiva de stock de postres: por cada entrada con cantidad > 0 registra
 * una ENTRADA y suma al stock del producto. Solo acepta productos de la
 * categoría postres.
 */
export async function loadPostresStock(
  entries: { productId: string; quantity: number }[],
  userId?: string
) {
  const catId = await getPostresCategoryId();
  if (!catId) throw new Error('No existe la categoría de postres');

  const valid = entries.filter((e) => e.productId && Math.floor(Number(e.quantity)) > 0);
  if (valid.length === 0) throw new Error('Ingresá al menos una cantidad');

  const postres = await prisma.product.findMany({
    where: { id: { in: valid.map((e) => e.productId) }, categoryId: catId },
    select: { id: true },
  });
  const allowed = new Set(postres.map((p) => p.id));

  let applied = 0;
  for (const e of valid) {
    if (!allowed.has(e.productId)) continue;
    await adjustStock(e.productId, 'ENTRADA', Math.floor(Number(e.quantity)), 'Carga de stock (Postres)', userId);
    applied++;
  }
  if (applied === 0) throw new Error('Ninguno de los productos es un postre válido');
  return applied;
}

/**
 * Retira dinero del "a favor" de postres. Valida que no exceda el disponible y
 * SOLO descuenta del a favor (registra un PostreWithdrawal). NO impacta en
 * Finanzas: el egreso real, si corresponde, se carga a mano — porque a veces el
 * retiro no es dinero (se cambia por mercadería).
 */
export async function withdrawPostres(amount: number, reason: string, userId?: string) {
  const amt = Number(amount);
  if (!(amt > 0)) throw new Error('El importe debe ser mayor a 0');

  const data = await getPostresData();
  if (amt > data.dineroAFavor + 1e-6) {
    throw new Error(
      `No podés retirar más que el dinero a favor de postres ($${data.dineroAFavor.toFixed(2)})`
    );
  }

  return prisma.postreWithdrawal.create({
    data: {
      amount: amt,
      reason: reason?.trim() ? reason.trim() : null,
      createdById: userId ?? null,
    },
  });
}
