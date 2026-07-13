import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { getOpenCashRegister } from '@/services/finance.service';
import type { EmployeeInput, EmployeeMovementInput } from '@/lib/validators';

/**
 * Saldos por empleado a partir de EmployeeMovement:
 *  - adelantosPendientes = ADELANTO − ADELANTO_DESCUENTO
 *  - acumulado           = ACUMULADO_APORTE − ACUMULADO_RETIRO
 */
async function getBalancesMap() {
  const grouped = await prisma.employeeMovement.groupBy({
    by: ['employeeId', 'kind'],
    _sum: { amount: true },
  });
  const map: Record<string, { adelantosPendientes: number; acumulado: number }> = {};
  for (const g of grouped) {
    if (!map[g.employeeId]) map[g.employeeId] = { adelantosPendientes: 0, acumulado: 0 };
    const sum = toNumber(g._sum.amount);
    if (g.kind === 'ADELANTO') map[g.employeeId].adelantosPendientes += sum;
    else if (g.kind === 'ADELANTO_DESCUENTO') map[g.employeeId].adelantosPendientes -= sum;
    else if (g.kind === 'ACUMULADO_APORTE') map[g.employeeId].acumulado += sum;
    else if (g.kind === 'ACUMULADO_RETIRO') map[g.employeeId].acumulado -= sum;
  }
  return map;
}

export async function listEmployees(includeInactive = true) {
  const [employees, balances] = await Promise.all([
    prisma.employee.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    }),
    getBalancesMap(),
  ]);
  return employees.map((e) => ({
    ...e,
    adelantosPendientes: balances[e.id]?.adelantosPendientes ?? 0,
    acumulado: balances[e.id]?.acumulado ?? 0,
  }));
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
    take: 50,
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
