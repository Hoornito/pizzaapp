import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/utils';

/**
 * Busca una cuenta por email sin distinguir mayúsculas ("Jorge@..." y
 * "jorge@..." son la misma casilla). Si quedaran duplicados viejos de antes de
 * normalizar, gana la cuenta más antigua, que es la que tiene el historial.
 */
export function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Borra una cuenta de cliente desde el panel.
 *
 * - Las cuentas del personal (ADMIN / MOSTRADOR) no se borran desde acá, así
 *   nadie deja al local sin acceso al panel por un clic.
 * - Una cuenta con pedidos tampoco: los pedidos son el historial de ventas y
 *   la caja, no pueden quedar huérfanos.
 * - Lo demás (direcciones, carrito, dispositivos, cuentas de Google) se borra
 *   en cascada; si estaba vinculada a un empleado, el empleado queda sin cuenta.
 */
export async function deleteCustomerUser(id: string, actorId: string) {
  if (id === actorId) throw new Error('No podés borrar tu propia cuenta');

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, _count: { select: { orders: true } } },
  });
  if (!user) throw new Error('Usuario no encontrado');
  if (user.role !== 'CUSTOMER') {
    throw new Error('Las cuentas del personal (admin/mostrador) no se pueden borrar desde el panel');
  }
  if (user._count.orders > 0) {
    throw new Error(
      `Tiene ${user._count.orders} pedido(s): no se puede borrar porque son parte del historial de ventas`
    );
  }

  await prisma.user.delete({ where: { id } });
}
