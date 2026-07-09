import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { toNumber, orderCashPortion } from '@/lib/utils';
import {
  FINANCE_CATEGORY_SUELDOS,
  FINANCE_CATEGORY_ADELANTOS,
  FINANCE_CATEGORY_SOBRES,
} from '@/lib/constants';
import type { CashRegister } from '@prisma/client';
import type {
  FinanceTransactionInput,
  OpenCashRegisterInput,
  CloseCashRegisterInput,
} from '@/lib/validators';

/**
 * Devuelve la caja abierta actual (si existe). Solo puede haber una a la vez.
 */
export async function getOpenCashRegister() {
  return prisma.cashRegister.findFirst({
    where: { status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

/**
 * Calcula el efectivo esperado en una caja:
 *   saldo inicial
 * + ventas de pedidos en EFECTIVO durante la sesión
 * + ingresos manuales en EFECTIVO
 * - egresos manuales en EFECTIVO
 */
export async function computeExpectedCash(register: CashRegister): Promise<number> {
  const from = register.openedAt;
  const to = register.closedAt ?? new Date();

  const [cashOrders, cashTxns] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { not: 'CANCELADO' },
        // efectivo puro o mixto (sólo cuenta su porción en efectivo)
        paymentMethod: { in: ['EFECTIVO', 'MIXTO'] },
        // solo pedidos efectivamente cobrados durante la sesión
        payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } },
      },
      select: { total: true, paymentMethod: true, cashAmount: true },
    }),
    prisma.financeTransaction.findMany({
      where: { cashRegisterId: register.id, paymentMethod: 'EFECTIVO' },
      select: { type: true, amount: true },
    }),
  ]);

  const cashSales = cashOrders.reduce((s, o) => s + orderCashPortion(o), 0);
  let manualIn = 0;
  let manualOut = 0;
  for (const t of cashTxns) {
    if (t.type === 'INCOME') manualIn += toNumber(t.amount);
    else manualOut += toNumber(t.amount);
  }

  return toNumber(register.openingBalance) + cashSales + manualIn - manualOut;
}

export async function openCashRegister(input: OpenCashRegisterInput, userId?: string) {
  const existing = await getOpenCashRegister();
  if (existing) {
    throw new Error('Ya hay una caja abierta. Cerrala antes de abrir una nueva.');
  }
  return prisma.cashRegister.create({
    data: {
      status: 'OPEN',
      shift: input.shift,
      openingBalance: input.openingBalance,
      notes: input.notes ?? null,
      openedById: userId ?? null,
    },
  });
}

export async function closeCashRegister(input: CloseCashRegisterInput, userId?: string) {
  const register = await getOpenCashRegister();
  if (!register) {
    throw new Error('No hay una caja abierta para cerrar.');
  }
  const expected = await computeExpectedCash(register);
  const difference = input.countedCash - expected;

  return prisma.cashRegister.update({
    where: { id: register.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      expectedCash: expected,
      countedCash: input.countedCash,
      difference,
      closedById: userId ?? null,
      notes: input.notes ?? register.notes,
    },
  });
}

export async function createFinanceTransaction(
  input: FinanceTransactionInput,
  userId?: string
) {
  const register = await getOpenCashRegister();
  if (!register) {
    throw new Error('Debés abrir la caja antes de registrar movimientos.');
  }
  const txn = await prisma.financeTransaction.create({
    data: {
      cashRegisterId: register.id,
      type: input.type,
      amount: input.amount,
      category: input.category,
      description: input.description ?? null,
      paymentMethod: input.paymentMethod,
      employeeId: input.employeeId ?? null,
      createdById: userId ?? null,
    },
  });

  // Un adelanto con empleado suma al "pendiente" del empleado
  if (input.category === FINANCE_CATEGORY_ADELANTOS && input.employeeId) {
    await prisma.employeeMovement.create({
      data: {
        employeeId: input.employeeId,
        kind: 'ADELANTO',
        amount: input.amount,
        financeTransactionId: txn.id,
        createdById: userId ?? null,
      },
    });
  }

  return txn;
}

export async function deleteFinanceTransaction(id: string) {
  // Revertir el adelanto del saldo del empleado, si existía
  await prisma.employeeMovement.deleteMany({ where: { financeTransactionId: id } });
  return prisma.financeTransaction.delete({ where: { id } });
}

const isVirtualMethod = (m: string) => m === 'TRANSFERENCIA' || m === 'TARJETA';

/**
 * Totales financieros de un período [from, to] para el panel de reportes.
 * "virtual" = transferencias + tarjeta (movimientos manuales) + Mercado Pago (pedidos).
 */
export async function getFinanceTotals(from: Date, to: Date) {
  const [orders, txns, registers, descuentos] = await Promise.all([
    prisma.order.findMany({
      // ingreso recién cuando el pedido fue cobrado (paidAt dentro del período)
      where: {
        status: { not: 'CANCELADO' },
        payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } },
      },
      select: { total: true, paymentMethod: true, cashAmount: true },
    }),
    prisma.financeTransaction.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        type: true,
        amount: true,
        category: true,
        paymentMethod: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.cashRegister.findMany({
      where: { openedAt: { gte: from, lte: to } },
      select: { openingBalance: true, countedCash: true },
    }),
    prisma.employeeMovement.findMany({
      where: { kind: 'ADELANTO_DESCUENTO', createdAt: { gte: from, lte: to } },
      select: { employeeId: true, amount: true, employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  // Desglose por empleado (Sueldos / Adelantos otorgados / descontados / neto)
  type EmpRow = {
    id: string;
    name: string;
    sueldos: number;
    adelantosOtorgados: number;
    adelantosDescontado: number;
    adelantoNeto: number;
    total: number;
  };
  const employeeMap: Record<string, EmpRow> = {};
  const ensureEmp = (id: string, name: string): EmpRow => {
    if (!employeeMap[id]) {
      employeeMap[id] = { id, name, sueldos: 0, adelantosOtorgados: 0, adelantosDescontado: 0, adelantoNeto: 0, total: 0 };
    }
    return employeeMap[id];
  };

  let orderCashSales = 0;
  let orderVirtualSales = 0;
  let cantEfectivo = 0;
  let cantVirtual = 0;
  for (const o of orders) {
    const amt = toNumber(o.total);
    const cash = orderCashPortion(o); // EFECTIVO=total, MIXTO=cashAmount, MP=0
    orderCashSales += cash;
    orderVirtualSales += amt - cash;
    // Cliente en efectivo: pagó en efectivo o mixto (tocan la caja). Cualquier
    // otro método (transferencia, tarjeta/QR, Mercado Pago) cuenta como virtual.
    if (o.paymentMethod === 'EFECTIVO' || o.paymentMethod === 'MIXTO') cantEfectivo++;
    else cantVirtual++;
  }

  let manualCashIncome = 0;
  let manualVirtualIncome = 0;
  let cashExpense = 0;
  let virtualExpense = 0;
  // "Otros gastos" = egresos SIN sueldos (los sueldos se muestran aparte).
  let otrosGastosEfectivo = 0;
  let otrosGastosVirtual = 0;
  let sueldosEfectivo = 0;
  let sueldosVirtual = 0;
  let adelantosEfectivo = 0;
  let adelantosVirtual = 0;
  let sobres = 0;
  for (const t of txns) {
    const amt = toNumber(t.amount);
    const virtual = isVirtualMethod(t.paymentMethod);
    if (t.type === 'INCOME') {
      if (t.paymentMethod === 'EFECTIVO') manualCashIncome += amt;
      else if (virtual) manualVirtualIncome += amt;
    } else {
      if (t.paymentMethod === 'EFECTIVO') cashExpense += amt;
      else if (virtual) virtualExpense += amt;

      // Otros gastos = todo egreso menos sueldos.
      if (t.category !== FINANCE_CATEGORY_SUELDOS) {
        if (t.paymentMethod === 'EFECTIVO') otrosGastosEfectivo += amt;
        else if (virtual) otrosGastosVirtual += amt;
      }

      if (t.category === FINANCE_CATEGORY_SUELDOS) {
        if (t.paymentMethod === 'EFECTIVO') sueldosEfectivo += amt;
        else if (virtual) sueldosVirtual += amt;
      } else if (t.category === FINANCE_CATEGORY_ADELANTOS) {
        if (t.paymentMethod === 'EFECTIVO') adelantosEfectivo += amt;
        else if (virtual) adelantosVirtual += amt;
      } else if (t.category === FINANCE_CATEGORY_SOBRES) {
        sobres += amt;
      }

      // Acumular por empleado para Sueldos/Adelantos
      const isSueldo = t.category === FINANCE_CATEGORY_SUELDOS;
      const isAdelanto = t.category === FINANCE_CATEGORY_ADELANTOS;
      if ((isSueldo || isAdelanto) && t.employeeId) {
        const name = t.employee
          ? `${t.employee.firstName} ${t.employee.lastName}`
          : 'Empleado eliminado';
        const row = ensureEmp(t.employeeId, name);
        if (isSueldo) row.sueldos += amt;
        else row.adelantosOtorgados += amt;
      }
    }
  }

  // Descuentos de adelanto del período (no tocan caja, sí el neto por empleado)
  for (const d of descuentos) {
    const name = d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : 'Empleado eliminado';
    ensureEmp(d.employeeId, name).adelantosDescontado += toNumber(d.amount);
  }

  const byEmployee = Object.values(employeeMap)
    .map((r) => ({
      ...r,
      adelantoNeto: r.adelantosOtorgados - r.adelantosDescontado,
      total: r.sueldos + r.adelantosOtorgados,
    }))
    .sort((a, b) => b.total - a.total);

  const cajaIngresada = registers.reduce((s, r) => s + toNumber(r.openingBalance), 0);
  const realEnCaja = registers.reduce(
    (s, r) => s + (r.countedCash != null ? toNumber(r.countedCash) : 0),
    0
  );

  const totalEfectivoIngresado = orderCashSales + manualCashIncome;
  const totalVirtualIngresado = orderVirtualSales + manualVirtualIncome;

  return {
    cajaIngresada,
    totalEfectivoIngresado,
    totalVirtualIngresado,
    cashExpense,
    virtualExpense,
    otrosGastosEfectivo,
    otrosGastosVirtual,
    sueldosEfectivo,
    sueldosVirtual,
    adelantosEfectivo,
    adelantosVirtual,
    sobres,
    totalVirtualNeto: totalVirtualIngresado - virtualExpense,
    totalCaja: cajaIngresada + totalEfectivoIngresado - cashExpense,
    realEnCaja,
    cantEfectivo,
    cantVirtual,
    totalOperaciones: cantEfectivo + cantVirtual,
    byEmployee,
  };
}

export interface LedgerRow {
  id: string;
  time: Date;
  type: 'INCOME' | 'EXPENSE';
  source: 'MANUAL' | 'ORDER';
  category: string;
  description: string | null;
  paymentMethod: string;
  amount: number;
  employeeName?: string | null;
}

/**
 * Resumen financiero de un día: totales (ventas + manuales), libro de
 * movimientos y estado de la caja abierta con su efectivo esperado en vivo.
 */
/**
 * Convierte un string "YYYY-MM-DD" en una fecha local (medianoche en la zona
 * horaria del servidor) para evitar el corrimiento de día que produce
 * `new Date("YYYY-MM-DD")`, que se interpreta como UTC.
 */
export function parseLocalDate(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

/**
 * Resumen de Finanzas del TURNO ACTUAL (la caja abierta). Se reinicia por turno:
 * al cerrar la caja no queda ninguna abierta, así que devuelve todo en 0 hasta
 * que se abra la próxima. El registro completo del día vive en Reportes.
 */
export async function getFinanceSummary() {
  const [openRegister, history] = await Promise.all([
    getOpenCashRegister(),
    prisma.cashRegister.findMany({ orderBy: { openedAt: 'desc' }, take: 10 }),
  ]);

  const emptyTotals = {
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    orderTotalSales: 0,
    orderCashSales: 0,
    manualIncome: 0,
    manualExpense: 0,
  };

  // Sin caja abierta → nada que mostrar (el día completo está en Reportes).
  if (!openRegister) {
    return { date: new Date().toISOString(), totals: emptyTotals, register: null, expectedCash: null, ledger: [], history };
  }

  const from = openRegister.openedAt;
  const to = new Date();

  const [ordersSession, manualTxns] = await Promise.all([
    prisma.order.findMany({
      // ventas cobradas durante esta sesión de caja (por fecha de pago)
      where: {
        status: { not: 'CANCELADO' },
        payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paymentMethod: true,
        cashAmount: true,
        createdAt: true,
        payment: { select: { paidAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // movimientos manuales asociados a esta caja
    prisma.financeTransaction.findMany({
      where: { cashRegisterId: openRegister.id },
      orderBy: { createdAt: 'asc' },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const orderTotalSales = ordersSession.reduce((s, o) => s + toNumber(o.total), 0);
  // efectivo del turno = efectivo puro + porción en efectivo de los mixtos
  const orderCashSales = ordersSession.reduce((s, o) => s + orderCashPortion(o), 0);

  let manualIncome = 0;
  let manualExpense = 0;
  for (const t of manualTxns) {
    if (t.type === 'INCOME') manualIncome += toNumber(t.amount);
    else manualExpense += toNumber(t.amount);
  }

  const totalIncome = orderTotalSales + manualIncome;
  const totalExpense = manualExpense;

  const ledger: LedgerRow[] = [
    ...ordersSession.map((o) => ({
      id: `order-${o.id}`,
      time: o.payment?.paidAt ?? o.createdAt,
      type: 'INCOME' as const,
      source: 'ORDER' as const,
      category: 'Venta pedido',
      description: `Pedido #${o.orderNumber}`,
      paymentMethod: o.paymentMethod,
      amount: toNumber(o.total),
    })),
    ...manualTxns.map((t) => ({
      id: t.id,
      time: t.createdAt,
      type: t.type,
      source: 'MANUAL' as const,
      category: t.category,
      description: t.description,
      paymentMethod: t.paymentMethod,
      amount: toNumber(t.amount),
      employeeName: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : null,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const expectedCash = await computeExpectedCash(openRegister);

  return {
    date: from.toISOString(),
    totals: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      orderTotalSales,
      orderCashSales,
      manualIncome,
      manualExpense,
    },
    register: { ...openRegister, expectedCash },
    expectedCash,
    ledger,
    history,
  };
}
