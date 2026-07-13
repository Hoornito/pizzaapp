import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { toNumber, orderCashPortion } from '@/lib/utils';
import {
  FINANCE_CATEGORY_SUELDOS,
  FINANCE_CATEGORY_ADELANTOS,
  FINANCE_CATEGORY_SOBRES,
} from '@/lib/constants';
import type { CashRegister, CashShift, Prisma } from '@prisma/client';
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
      where: { cashRegisterId: register.id },
      select: { type: true, amount: true, paymentMethod: true, cashAmount: true },
    }),
  ]);

  const cashSales = cashOrders.reduce((s, o) => s + orderCashPortion(o), 0);
  let manualIn = 0;
  let manualOut = 0;
  for (const t of cashTxns) {
    // Porción en efectivo: EFECTIVO = total; MIXTO = cashAmount; resto = 0.
    const cash =
      t.paymentMethod === 'EFECTIVO'
        ? toNumber(t.amount)
        : t.paymentMethod === 'MIXTO'
          ? toNumber(t.cashAmount ?? 0)
          : 0;
    if (cash === 0) continue;
    if (t.type === 'INCOME') manualIn += cash;
    else manualOut += cash;
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
      shift: input.shift ?? null,
      isTest: input.isTest ?? false,
      openingBalance: input.openingBalance,
      notes: input.notes ?? null,
      openedById: userId ?? null,
    },
  });
}

/**
 * Cierra una caja de SIMULACIÓN: borra todo lo generado en el entrenamiento
 * (pedidos test, movimientos manuales de esa caja y movimientos de empleados de
 * la simulación) y elimina la caja, de modo que nada quede en reportes.
 */
async function closeTestRegister(register: CashRegister) {
  const openedAt = register.openedAt;
  // Egresos/ingresos manuales de esta caja test (y los movimientos de empleado
  // que hayan generado, p. ej. adelantos/acumulados).
  const testTxns = await prisma.financeTransaction.findMany({
    where: { cashRegisterId: register.id },
    select: { id: true },
  });
  const txnIds = testTxns.map((t) => t.id);

  await prisma.$transaction([
    prisma.employeeMovement.deleteMany({
      where: { OR: [{ isTest: true }, { financeTransactionId: { in: txnIds } }] },
    }),
    prisma.financeTransaction.deleteMany({ where: { cashRegisterId: register.id } }),
    // Los OrderItem y Payment se borran en cascada al borrar el pedido.
    prisma.order.deleteMany({ where: { isTest: true, createdAt: { gte: openedAt } } }),
    prisma.cashRegister.delete({ where: { id: register.id } }),
  ]);

  return { id: register.id, isTest: true as const };
}

export async function closeCashRegister(input: CloseCashRegisterInput, userId?: string) {
  const register = await getOpenCashRegister();
  if (!register) {
    throw new Error('No hay una caja abierta para cerrar.');
  }
  // Caja de simulación: no hay arqueo; se descarta todo lo del entrenamiento.
  if (register.isTest) {
    return closeTestRegister(register);
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
      // La porción en efectivo solo aplica al método MIXTO.
      cashAmount: input.paymentMethod === 'MIXTO' ? input.cashAmount ?? 0 : null,
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

  // Sueldo con "acumula a favor": suma al acumulado del empleado (sin tocar caja).
  if (
    input.category === FINANCE_CATEGORY_SUELDOS &&
    input.employeeId &&
    input.accumulate &&
    input.accumulate > 0
  ) {
    await prisma.employeeMovement.create({
      data: {
        employeeId: input.employeeId,
        kind: 'ACUMULADO_APORTE',
        amount: input.accumulate,
        // Vinculado al egreso: si se borra el sueldo, se revierte el acumulado.
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
 *
 * Si se pasa `shift`, filtra por ese turno usando las SESIONES DE CAJA de ese
 * turno (por sus horarios reales de apertura/cierre). Así, p. ej., un pedido
 * cobrado a la 1 AM entra en el turno noche del día anterior (que cerró a esa
 * hora) y no en el turno mañana del día siguiente.
 */
export async function getFinanceTotals(from: Date, to: Date, shift?: CashShift | 'BOTH') {
  // Filtro de turno: 'BOTH' = ambos turnos (por sesión de caja); MANANA/NOCHE = ese turno.
  const shiftWhere: Prisma.EnumCashShiftNullableFilter | undefined =
    shift === 'BOTH' ? { in: ['MANANA', 'NOCHE'] } : shift ? { equals: shift } : undefined;

  // Cajas del período (opcionalmente filtradas por turno).
  const registers = await prisma.cashRegister.findMany({
    where: { openedAt: { gte: from, lte: to }, ...(shiftWhere ? { shift: shiftWhere } : {}) },
  });

  // Ventanas de tiempo: con turno = las sesiones de esas cajas; sin turno = todo el período.
  const windows = shift
    ? registers.map((r) => ({ from: r.openedAt, to: r.closedAt ?? new Date() }))
    : [{ from, to }];
  const registerIds = registers.map((r) => r.id);
  const noRows: Prisma.OrderWhereInput = { id: { in: [] } };

  // Pedidos cobrados dentro de las ventanas del turno (o del período).
  const paidOrderWhere: Prisma.OrderWhereInput = shift
    ? windows.length === 0
      ? noRows
      : {
          status: { not: 'CANCELADO' },
          OR: windows.map((w) => ({ payment: { status: 'APPROVED', paidAt: { gte: w.from, lte: w.to } } })),
        }
    : { status: { not: 'CANCELADO' }, payment: { status: 'APPROVED', paidAt: { gte: from, lte: to } } };

  const [orders, txns, descuentos] = await Promise.all([
    prisma.order.findMany({ where: paidOrderWhere, select: { total: true, paymentMethod: true, cashAmount: true } }),
    prisma.financeTransaction.findMany({
      // Con turno: solo los movimientos manuales de esas cajas.
      where: shift ? { cashRegisterId: { in: registerIds } } : { createdAt: { gte: from, lte: to } },
      select: {
        type: true,
        amount: true,
        cashAmount: true,
        category: true,
        paymentMethod: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.employeeMovement.findMany({
      where: {
        kind: 'ADELANTO_DESCUENTO',
        ...(shift
          ? windows.length === 0
            ? { id: { in: [] } }
            : { OR: windows.map((w) => ({ createdAt: { gte: w.from, lte: w.to } })) }
          : { createdAt: { gte: from, lte: to } }),
      },
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
    // Porciones efectivo / virtual (MIXTO se reparte; el resto va entero a una).
    const cashPart =
      t.paymentMethod === 'EFECTIVO'
        ? amt
        : t.paymentMethod === 'MIXTO'
          ? toNumber(t.cashAmount ?? 0)
          : 0;
    const virtualPart = isVirtualMethod(t.paymentMethod)
      ? amt
      : t.paymentMethod === 'MIXTO'
        ? amt - cashPart
        : 0;
    if (t.type === 'INCOME') {
      manualCashIncome += cashPart;
      manualVirtualIncome += virtualPart;
    } else {
      cashExpense += cashPart;
      virtualExpense += virtualPart;

      // Otros gastos = todo egreso menos sueldos.
      if (t.category !== FINANCE_CATEGORY_SUELDOS) {
        otrosGastosEfectivo += cashPart;
        otrosGastosVirtual += virtualPart;
      }

      if (t.category === FINANCE_CATEGORY_SUELDOS) {
        sueldosEfectivo += cashPart;
        sueldosVirtual += virtualPart;
      } else if (t.category === FINANCE_CATEGORY_ADELANTOS) {
        adelantosEfectivo += cashPart;
        adelantosVirtual += virtualPart;
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

  // Total caja ESPERADO = suma del esperado por turno (mismo criterio que el
  // arqueo de cada cierre en Finanzas). Antes se calculaba como aperturas +
  // ventas del período − gastos, lo que mezclaba turnos y no cuadraba contra el
  // "real en caja". Recordá que la apertura es el efectivo YA existente contado
  // al abrir (no se suma dinero nuevo), así que el esperado por turno ya lo toma.
  let totalCajaEsperado = 0;
  for (const r of registers) {
    if (r.status === 'OPEN') totalCajaEsperado += await computeExpectedCash(r);
    else totalCajaEsperado += toNumber(r.expectedCash ?? 0);
  }

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
    totalCaja: totalCajaEsperado,
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
  // Solo sueldos: monto que quedó "a favor" del empleado (no sale de caja).
  accumulate?: number;
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

  // Aportes "a favor" vinculados a los sueldos del turno: los mostramos en el
  // libro (aunque no salgan de caja) para que el sueldo no aparezca en $0.
  const aportes = await prisma.employeeMovement.findMany({
    where: { kind: 'ACUMULADO_APORTE', financeTransactionId: { in: manualTxns.map((t) => t.id) } },
    select: { financeTransactionId: true, amount: true },
  });
  const accByTxn = new Map(aportes.map((a) => [a.financeTransactionId, toNumber(a.amount)]));

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
      accumulate: accByTxn.get(t.id) ?? 0,
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
