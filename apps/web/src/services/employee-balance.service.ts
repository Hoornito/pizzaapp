import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';

/**
 * Saldos por empleado, derivados de EmployeeMovement:
 *  - adelantosPendientes = ADELANTO − ADELANTO_DESCUENTO
 *  - acumulado           = ACUMULADO_APORTE − ACUMULADO_RETIRO  ("dinero guardado")
 *
 * Vive en su propio módulo —y no en employee.service— porque lo necesitan tanto
 * Empleados como Finanzas, y employee.service ya depende de finance.service:
 * ponerlo en cualquiera de los dos armaba un import circular.
 */

export type EmployeeBalance = { adelantosPendientes: number; acumulado: number };

const emptyBalance = (): EmployeeBalance => ({ adelantosPendientes: 0, acumulado: 0 });

function applyMovement(balance: EmployeeBalance, kind: string, amount: number) {
  if (kind === 'ADELANTO') balance.adelantosPendientes += amount;
  else if (kind === 'ADELANTO_DESCUENTO') balance.adelantosPendientes -= amount;
  else if (kind === 'ACUMULADO_APORTE') balance.acumulado += amount;
  else if (kind === 'ACUMULADO_RETIRO') balance.acumulado -= amount;
}

/** Saldos de todos los empleados, indexados por id. */
export async function getEmployeeBalances(): Promise<Record<string, EmployeeBalance>> {
  const grouped = await prisma.employeeMovement.groupBy({
    by: ['employeeId', 'kind'],
    _sum: { amount: true },
  });

  const map: Record<string, EmployeeBalance> = {};
  for (const g of grouped) {
    if (!map[g.employeeId]) map[g.employeeId] = emptyBalance();
    applyMovement(map[g.employeeId], g.kind, toNumber(g._sum.amount));
  }
  return map;
}

/** Saldos de un empleado puntual. */
export async function getEmployeeBalance(employeeId: string): Promise<EmployeeBalance> {
  const grouped = await prisma.employeeMovement.groupBy({
    by: ['kind'],
    where: { employeeId },
    _sum: { amount: true },
  });

  const balance = emptyBalance();
  for (const g of grouped) applyMovement(balance, g.kind, toNumber(g._sum.amount));
  return balance;
}
