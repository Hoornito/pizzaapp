import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, eachDayOfInterval } from 'date-fns';
import type { ReportData, DashboardStats } from '@/types/api.types';
import type { CashShift, Prisma } from '@prisma/client';
import { toNumber } from '@/lib/utils';
import { getFinanceTotals, parseLocalDate } from './finance.service';

type Period = 'daily' | 'weekly' | 'monthly' | 'annual' | 'day' | 'week' | 'month';

function getPeriodRange(period: Period, date: Date = new Date()) {
  switch (period) {
    case 'day':
    case 'daily':
      return { from: startOfDay(date), to: endOfDay(date) };
    case 'week':
    case 'weekly':
      return { from: startOfWeek(date, { weekStartsOn: 1 }), to: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'month':
    case 'monthly':
      return { from: startOfMonth(date), to: endOfMonth(date) };
    case 'annual':
      return { from: startOfYear(date), to: endOfYear(date) };
  }
}

export async function getReportData(period: Period, date?: Date | string, shift?: CashShift | 'BOTH') {
  const dateObj = date ? (typeof date === 'string' ? parseLocalDate(date) : date) : new Date();
  const { from, to } = getPeriodRange(period, dateObj);

  // Con turno, acotamos a las SESIONES DE CAJA de ese turno (por sus horarios
  // reales), así el cierre de la 1 AM queda en el turno noche del día anterior.
  // 'BOTH' = ambos turnos (mañana + noche) por sesión de caja.
  const shiftWhere: Prisma.EnumCashShiftNullableFilter | undefined =
    shift === 'BOTH' ? { in: ['MANANA', 'NOCHE'] } : shift ? { equals: shift } : undefined;

  let orderWhere: Prisma.OrderWhereInput = {
    status: { notIn: ['CANCELADO'] },
    payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } },
  };
  if (shiftWhere) {
    const regs = await prisma.cashRegister.findMany({ where: { shift: shiftWhere, openedAt: { gte: from, lte: to } } });
    orderWhere =
      regs.length === 0
        ? { id: { in: [] } }
        : {
            status: { notIn: ['CANCELADO'] },
            OR: regs.map((r) => ({
              payment: { status: 'APPROVED' as const, paidAt: { gte: r.openedAt, lte: r.closedAt ?? new Date() } },
            })),
          };
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      items: {
        include: { product: { include: { category: true } }, promotion: true },
      },
      payment: true,
    },
  });

  const cancelledCount = await prisma.order.count({
    where: { createdAt: { gte: from, lte: to }, status: 'CANCELADO' },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + toNumber(o.total), 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === 'ENTREGADO').length;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top products
  const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  const promotionSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

  for (const order of orders) {
    for (const item of order.items) {
      if (item.product) {
        if (!productSales[item.product.id]) {
          productSales[item.product.id] = { name: item.product.name, quantity: 0, revenue: 0 };
        }
        productSales[item.product.id].quantity += item.quantity;
        productSales[item.product.id].revenue += toNumber(item.subtotal);
      }
      if (item.promotion) {
        if (!promotionSales[item.promotion.id]) {
          promotionSales[item.promotion.id] = { name: item.promotion.name, quantity: 0, revenue: 0 };
        }
        promotionSales[item.promotion.id].quantity += item.quantity;
        promotionSales[item.promotion.id].revenue += toNumber(item.subtotal);
      }
    }
  }

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const topPromotions = Object.values(promotionSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Todos los productos con lo vendido en el período (incluye los que NO se
  // vendieron, para ver qué sale y qué no). Nota: las empanadas elegidas dentro
  // de una promo cuentan como parte de la promo, no como producto suelto.
  const productsCatalog = await prisma.product.findMany({
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const allProducts = productsCatalog
    .map((p) => {
      const s = productSales[p.id];
      return {
        name: p.name,
        category: p.category?.name ?? '—',
        quantity: s?.quantity ?? 0,
        revenue: s?.revenue ?? 0,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

  // Revenue by day
  const days = eachDayOfInterval({ start: from, end: to });
  const revenueByDay = days.map((day) => {
    const dayOrders = orders.filter(
      (o) =>
        o.payment?.paidAt &&
        format(new Date(o.payment.paidAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    return {
      date: format(day, 'yyyy-MM-dd'),
      revenue: dayOrders.reduce((sum, o) => sum + toNumber(o.total), 0),
      orders: dayOrders.length,
    };
  });

  const finance = await getFinanceTotals(from, to, shift);

  // (El detalle de Postres se muestra ahora en su propia solapa, no en Reportes.)

  return {
    period,
    totalRevenue,
    totalOrders,
    averageTicket,
    deliveredOrders,
    cancelledOrders: cancelledCount,
    topProducts,
    topPromotions,
    allProducts,
    revenueByDay,
    finance,
  };
}

export async function getDashboardStats() {
  const now = new Date();
  const todayRange = getPeriodRange('daily', now);
  const weekRange = getPeriodRange('weekly', now);
  const monthRange = getPeriodRange('monthly', now);

  // Last 7 days for chart
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [todayOrders, weekOrders, monthOrders, activeOrders, pendingOrders, deliveredToday, recentOrders, last7DaysOrders] =
    await Promise.all([
      // Ingresos = solo lo cobrado (pago aprobado), imputado por fecha de pago
      prisma.order.findMany({
        where: { status: { not: 'CANCELADO' }, payment: { status: 'APPROVED', paidAt: { gte: todayRange.from, lte: todayRange.to } } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELADO' }, payment: { status: 'APPROVED', paidAt: { gte: weekRange.from, lte: weekRange.to } } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELADO' }, payment: { status: 'APPROVED', paidAt: { gte: monthRange.from, lte: monthRange.to } } },
        select: { total: true },
      }),
      prisma.order.count({ where: { status: { notIn: ['ENTREGADO', 'CANCELADO'] } } }),
      prisma.order.count({ where: { status: 'RECIBIDO' } }),
      prisma.order.count({
        where: { status: 'ENTREGADO', createdAt: { gte: todayRange.from, lte: todayRange.to } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELADO' }, payment: { status: 'APPROVED', paidAt: { gte: sevenDaysAgo } } },
        select: { total: true, payment: { select: { paidAt: true } } },
      }),
    ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + toNumber(o.total), 0);
  const weekRevenue = weekOrders.reduce((sum, o) => sum + toNumber(o.total), 0);
  const monthRevenue = monthOrders.reduce((sum, o) => sum + toNumber(o.total), 0);

  const revenueByDay = eachDayOfInterval({ start: sevenDaysAgo, end: now }).map((day) => {
    const dayStr = format(day, 'dd/MM');
    const dayOrders = last7DaysOrders.filter(
      (o) => o.payment?.paidAt && format(new Date(o.payment.paidAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    return { date: dayStr, revenue: dayOrders.reduce((s, o) => s + toNumber(o.total), 0) };
  });

  return {
    todayRevenue,
    weekRevenue,
    monthRevenue,
    activeOrders,
    pendingOrders,
    deliveredToday,
    revenueByDay,
    recentOrders,
  };
}
