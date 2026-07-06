/**
 * Resetea a CERO los datos del día de HOY para testear de limpio:
 *  - Movimientos manuales de finanzas (FinanceTransaction)
 *  - Cajas abiertas/cerradas hoy (CashRegister)
 *  - Pedidos de hoy (Order) → borra en cascada OrderItem y Payment
 *
 * SIN backup (uso de testing). Ejecutar:
 *   node ../../node_modules/tsx/dist/cli.mjs scripts/reset-today.ts
 */
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

const now = new Date();
const from = startOfDay(now);
const to = endOfDay(now);

async function main() {
  console.log(`Reseteando datos del ${from.toLocaleDateString('es-AR')}...\n`);

  // 1) Movimientos manuales de hoy (deben ir antes que las cajas por la FK)
  const txns = await prisma.financeTransaction.deleteMany({
    where: { createdAt: { gte: from, lte: to } },
  });

  // 2) Cajas de hoy (abiertas o cerradas)
  const regs = await prisma.cashRegister.deleteMany({
    where: { openedAt: { gte: from, lte: to } },
  });

  // 3) Pedidos de hoy (cascade → OrderItem + Payment)
  const orders = await prisma.order.deleteMany({
    where: { createdAt: { gte: from, lte: to } },
  });

  console.log(`✅ Movimientos manuales borrados: ${txns.count}`);
  console.log(`✅ Cajas borradas:               ${regs.count}`);
  console.log(`✅ Pedidos borrados:             ${orders.count}`);
  console.log('\nTodo en 0 para hoy. Listo para testear.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
