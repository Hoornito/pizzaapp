import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { adjustStock } from './product.service';
import { parseLocalDate } from './finance.service';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import type { CashShift, Prisma } from '@prisma/client';

const POSTRES_SLUG = 'postres';

type PostresPeriod = 'day' | 'week' | 'month';

function postresRange(period: PostresPeriod, date: Date) {
  switch (period) {
    case 'day':
      return { from: startOfDay(date), to: endOfDay(date) };
    case 'week':
      return { from: startOfWeek(date, { weekStartsOn: 1 }), to: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'month':
    default:
      return { from: startOfMonth(date), to: endOfMonth(date) };
  }
}

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

export interface GetPostresParams {
  period?: PostresPeriod;
  date?: string; // YYYY-MM-DD
  shift?: CashShift | 'BOTH';
}

/**
 * Panel de Postres.
 *  - Las métricas del PERÍODO (vendidos, ingresos, entradas, ventas diarias) se
 *    acotan por fecha y, si se pide, por turno (sesión de caja, como Reportes).
 *  - El "dinero a favor" y "total retirado" son SALDO ACUMULADO (histórico):
 *    dineroAFavor = ingresos históricos − retiros + ajustes manuales.
 *  - "stockTotal" = suma del stock actual de todos los postres.
 */
export async function getPostresData(params?: GetPostresParams) {
  const catId = await getPostresCategoryId();
  if (!catId) {
    return {
      products: [] as PostreProductRow[],
      ventasDiarias: [] as PostreVentaDia[],
      totalVendidos: 0,
      totalIngresos: 0,
      totalRetiros: 0,
      dineroAFavor: 0,
      stockTotal: 0,
      entradas: 0,
      period: params?.period ?? 'month',
    };
  }

  const period: PostresPeriod = params?.period ?? 'month';
  const dateObj = params?.date ? parseLocalDate(params.date) : new Date();
  const { from, to } = postresRange(period, dateObj);
  const shift = params?.shift;

  // Ventanas de cobro: con turno = sesiones de caja de ese turno; sin turno = el período.
  let paidWindows: { from: Date; to: Date }[] = [{ from, to }];
  if (shift) {
    const shiftWhere: Prisma.EnumCashShiftNullableFilter =
      shift === 'BOTH' ? { in: ['MANANA', 'NOCHE'] } : { equals: shift };
    const regs = await prisma.cashRegister.findMany({
      where: { shift: shiftWhere, openedAt: { gte: from, lte: to }, isTest: false },
    });
    paidWindows = regs.map((r) => ({ from: r.openedAt, to: r.closedAt ?? new Date() }));
  }

  // Pedidos con postres cobrados dentro del período/turno.
  const noRows: Prisma.OrderWhereInput = { id: { in: [] } };
  const periodWhere: Prisma.OrderWhereInput = shift
    ? paidWindows.length === 0
      ? noRows
      : {
          status: { not: 'CANCELADO' },
          isTest: false,
          items: { some: { product: { categoryId: catId } } },
          OR: paidWindows.map((w) => ({ payment: { status: 'APPROVED' as const, paidAt: { gte: w.from, lte: w.to } } })),
        }
    : {
        status: { not: 'CANCELADO' },
        isTest: false,
        payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } },
        items: { some: { product: { categoryId: catId } } },
      };

  const [products, periodOrders, retiros, adjustAgg, allTimeIngresoAgg, entradasAgg] = await Promise.all([
    prisma.product.findMany({ where: { categoryId: catId }, orderBy: { name: 'asc' } }),
    prisma.order.findMany({
      where: periodWhere,
      select: {
        createdAt: true,
        payment: { select: { paidAt: true } },
        items: { where: { product: { categoryId: catId } }, select: { quantity: true, subtotal: true } },
      },
    }),
    prisma.postreWithdrawal.findMany({ select: { amount: true } }),
    prisma.postreAdjustment.aggregate({ _sum: { amount: true } }),
    // Ingresos HISTÓRICOS por postres (para el saldo a favor, no depende del período).
    prisma.orderItem.aggregate({
      _sum: { subtotal: true },
      where: {
        product: { categoryId: catId },
        order: { status: { not: 'CANCELADO' }, isTest: false, payment: { status: 'APPROVED' } },
      },
    }),
    // Entradas de stock (carga) en el período.
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { kind: 'ENTRADA', createdAt: { gte: from, lte: to }, product: { categoryId: catId } },
    }),
  ]);

  // Agregado por día (fecha de cobro) + totales del período.
  const dayMap = new Map<string, { cantidad: number; total: number }>();
  let totalVendidos = 0;
  let totalIngresos = 0;
  for (const o of periodOrders) {
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
  const ajustes = toNumber(adjustAgg._sum.amount ?? 0);
  const ingresosHistoricos = toNumber(allTimeIngresoAgg._sum.subtotal ?? 0);
  const dineroAFavor = ingresosHistoricos - totalRetiros + ajustes;
  const stockTotal = products.reduce((s, p) => s + (p.stock ?? 0), 0);
  const entradas = entradasAgg._sum.quantity ?? 0;

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
    stockTotal,
    entradas,
    period,
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
