import { prisma } from '@/lib/prisma';
import { getOpenCashRegister } from '@/services/finance.service';
import { getEmployeeBalances } from '@/services/employee-balance.service';
import { seniorityMonths } from '@/lib/seniority';
import type { EmployeeInput, EmployeeMovementInput, SeniorityPayoutInput } from '@/lib/validators';

export async function listEmployees(includeInactive = true) {
  const [employees, balances, prepaid] = await Promise.all([
    prisma.employee.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      include: { user: { select: { id: true, email: true, role: true } } },
    }),
    getEmployeeBalances(),
    prisma.employeeSeniorityPayout.groupBy({ by: ['employeeId'], _sum: { years: true } }),
  ]);
  const prepaidById = Object.fromEntries(prepaid.map((p) => [p.employeeId, p._sum.years ?? 0]));
  return employees.map((e) => ({
    ...e,
    adelantosPendientes: balances[e.id]?.adelantosPendientes ?? 0,
    acumulado: balances[e.id]?.acumulado ?? 0,
    prepaidSeniorityYears: prepaidById[e.id] ?? 0,
  }));
}

// ─── Antigüedad pre-cobrada ─────────────────────────────────────────────────

export async function getSeniorityPayouts(employeeId: string) {
  return prisma.employeeSeniorityPayout.findMany({
    where: { employeeId },
    orderBy: { paidAt: 'desc' },
  });
}

/**
 * Registra años de antigüedad cobrados por adelantado. Solo se pueden
 * pre-cobrar años ya cumplidos: el total pre-cobrado no puede superar los años
 * completos de antigüedad (a la fecha de hoy).
 */
export async function addSeniorityPayout(employeeId: string, input: SeniorityPayoutInput, userId?: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Empleado no encontrado');
  if (input.paidAt < employee.hireDate) throw new Error('La fecha del cobro es anterior a la fecha de ingreso');
  if (input.paidAt > new Date()) throw new Error('La fecha del cobro no puede ser futura');

  const agg = await prisma.employeeSeniorityPayout.aggregate({ where: { employeeId }, _sum: { years: true } });
  const yaPrecobrados = agg._sum.years ?? 0;
  const cumplidos = Math.floor(seniorityMonths(employee.hireDate) / 12);
  const disponibles = cumplidos - yaPrecobrados;
  if (input.years > disponibles) {
    throw new Error(
      disponibles <= 0
        ? `No tiene años disponibles para pre-cobrar (${cumplidos} cumplidos, ${yaPrecobrados} ya pre-cobrados)`
        : `Solo puede pre-cobrar hasta ${disponibles} año${disponibles === 1 ? '' : 's'} (${cumplidos} cumplidos, ${yaPrecobrados} ya pre-cobrados)`
    );
  }

  return prisma.employeeSeniorityPayout.create({
    data: {
      employeeId,
      years: input.years,
      paidAt: input.paidAt,
      amount: input.amount ?? null,
      note: input.note || null,
      createdById: userId ?? null,
    },
  });
}

export async function deleteSeniorityPayout(employeeId: string, payoutId: string) {
  const { count } = await prisma.employeeSeniorityPayout.deleteMany({ where: { id: payoutId, employeeId } });
  if (!count) throw new Error('Registro no encontrado');
}

export async function addEmployeeMovement(
  employeeId: string,
  input: EmployeeMovementInput,
  userId?: string
) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Empleado no encontrado');
  // Si hay una caja de simulación abierta, el movimiento es de prueba (se borra
  // al cerrarla y no impacta en los saldos definitivos).
  const register = await getOpenCashRegister();
  return prisma.employeeMovement.create({
    data: {
      employeeId,
      kind: input.kind,
      amount: input.amount,
      note: input.note ?? null,
      isTest: !!register?.isTest,
      createdById: userId ?? null,
    },
  });
}

export async function getEmployeeMovements(employeeId: string) {
  return prisma.employeeMovement.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
}

export async function getEmployee(id: string) {
  return prisma.employee.findUnique({ where: { id } });
}

export async function createEmployee(input: EmployeeInput) {
  return prisma.employee.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      relativePhone: input.relativePhone ?? null,
      address: input.address ?? null,
      role: input.role,
      dailyWage: input.dailyWage,
      hireDate: input.hireDate,
      active: input.active,
    },
  });
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>) {
  return prisma.employee.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      relativePhone: input.relativePhone ?? null,
      address: input.address ?? null,
      role: input.role,
      dailyWage: input.dailyWage,
      hireDate: input.hireDate,
      active: input.active,
    },
  });
}

/** Empleados activos con rol Repartidor (para asignar a pedidos con envío). */
export async function listDeliveryEmployees() {
  return prisma.employee.findMany({
    where: { active: true, role: 'REPARTIDOR' },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
}

export async function deleteEmployee(id: string) {
  return prisma.employee.delete({ where: { id } });
}
