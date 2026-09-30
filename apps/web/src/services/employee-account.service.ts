import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getEmployeeBalance } from '@/services/employee-balance.service';

/**
 * Cuenta de acceso del empleado: el admin le crea un usuario (email +
 * contraseña) o le vincula uno que ya existe (p. ej. el que usa para pedir, o
 * con el que entra con Google). Con esa cuenta el empleado ve su legajo en el
 * perfil. El usuario sigue siendo un cliente normal: el vínculo no le da acceso
 * al panel.
 *
 * Como Google se enlaza por email con la cuenta existente, una cuenta creada acá
 * con el Gmail del empleado también le sirve para entrar con Google.
 */

const findUserByEmail = (email: string) =>
  prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });

async function getUnlinkedEmployee(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Empleado no encontrado');
  if (employee.userId) throw new Error('El empleado ya tiene una cuenta vinculada. Desvinculala primero.');
  return employee;
}

export async function createEmployeeAccount(employeeId: string, email: string, password: string) {
  const employee = await getUnlinkedEmployee(employeeId);
  if (await findUserByEmail(email)) {
    throw new Error('Ya existe una cuenta con ese email. Usá "Vincular cuenta existente".');
  }
  const hashed = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: 'CUSTOMER',
      employee: { connect: { id: employee.id } },
    },
    select: { id: true, email: true },
  });
}

export async function linkEmployeeAccount(employeeId: string, email: string) {
  await getUnlinkedEmployee(employeeId);
  const user = await findUserByEmail(email);
  if (!user) throw new Error('No hay ninguna cuenta con ese email. Podés crearla con "Crear cuenta".');
  if (user.employee) {
    throw new Error(`Esa cuenta ya está vinculada a ${user.employee.firstName} ${user.employee.lastName}.`);
  }
  await prisma.employee.update({ where: { id: employeeId }, data: { userId: user.id } });
  return { id: user.id, email: user.email };
}

export async function unlinkEmployeeAccount(employeeId: string) {
  await prisma.employee.update({ where: { id: employeeId }, data: { userId: null } });
}

/**
 * Nueva contraseña para la cuenta vinculada (si el empleado se la olvidó). Solo
 * para cuentas de cliente: el admin no puede pisar la clave de otra cuenta del
 * personal (admin/mostrador) desde acá.
 */
export async function resetEmployeeAccountPassword(employeeId: string, password: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { id: true, role: true } } },
  });
  if (!employee?.user) throw new Error('El empleado no tiene una cuenta vinculada');
  if (employee.user.role !== 'CUSTOMER') {
    throw new Error('Esa cuenta es del personal del panel: la contraseña se cambia desde su propio perfil.');
  }
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: employee.user.id }, data: { password: hashed } });
}

/**
 * Legajo del empleado vinculado a la cuenta (null si la cuenta no es de un
 * empleado). Es lo que el empleado ve en su perfil: sus datos, saldos,
 * antigüedad e historiales. Las notas internas que carga el admin en los
 * movimientos no se incluyen.
 */
export async function getMyEmployeeRecord(userId: string) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) return null;

  const [balance, movements, payments, seniorityPayouts] = await Promise.all([
    getEmployeeBalance(employee.id),
    prisma.employeeMovement.findMany({
      where: { employeeId: employee.id, isTest: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, kind: true, amount: true, createdAt: true },
    }),
    prisma.financeTransaction.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        amount: true,
        category: true,
        paymentMethod: true,
        createdAt: true,
        cashRegister: { select: { isTest: true } },
      },
    }),
    prisma.employeeSeniorityPayout.findMany({
      where: { employeeId: employee.id },
      orderBy: { paidAt: 'desc' },
      select: { id: true, years: true, paidAt: true, amount: true },
    }),
  ]);

  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    role: employee.role,
    phone: employee.phone,
    relativePhone: employee.relativePhone,
    address: employee.address,
    dailyWage: employee.dailyWage,
    hireDate: employee.hireDate,
    active: employee.active,
    adelantosPendientes: balance.adelantosPendientes,
    acumulado: balance.acumulado,
    movements,
    // Los pagos de una caja de simulación no son reales.
    payments: payments
      .filter((p) => !p.cashRegister?.isTest)
      .map(({ cashRegister: _cr, ...p }) => p),
    seniorityPayouts,
  };
}
