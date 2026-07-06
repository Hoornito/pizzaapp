/**
 * Prueba automatizada de los cálculos financieros (getFinanceTotals).
 * Crea datos en una ventana de fechas futura (2099) para NO mezclarse con
 * datos reales, valida cada total y limpia todo al final.
 *
 * Ejecutar:  node ../../node_modules/tsx/dist/cli.mjs scripts/test-finance.ts
 */
import { prisma } from '@/lib/prisma';
import { getFinanceTotals } from '@/services/finance.service';

const WINDOW_DAY = new Date(2099, 0, 15, 12, 0, 0); // mediodía 15/01/2099 local
const FROM = new Date(2099, 0, 15, 0, 0, 0, 0);
const TO = new Date(2099, 0, 15, 23, 59, 59, 999);

let pass = 0;
let fail = 0;
function check(label: string, got: number, expected: number) {
  const ok = Math.abs(got - expected) < 0.001;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${got}${ok ? '' : `  (esperado ${expected})`}`);
  ok ? pass++ : fail++;
}

async function main() {
  const tag = `TESTFIN_${Date.now()}`;

  // Usuario descartable para los pedidos
  const user = await prisma.user.create({
    data: { email: `${tag}@test.local`, name: 'Test Finance', role: 'CUSTOMER' },
  });

  // Pedidos en la ventana
  const orderCash = await prisma.order.create({
    data: { orderNumber: `${tag}-A`, userId: user.id, paymentMethod: 'EFECTIVO',
      subtotal: 1000, total: 1000, createdAt: WINDOW_DAY },
  });
  const orderVirtual = await prisma.order.create({
    data: { orderNumber: `${tag}-B`, userId: user.id, paymentMethod: 'MERCADO_PAGO',
      subtotal: 1500, total: 1500, createdAt: WINDOW_DAY },
  });

  // Caja cerrada en la ventana (apertura 5000, arqueo contado 5800)
  const register = await prisma.cashRegister.create({
    data: { status: 'CLOSED', shift: 'MANANA', openingBalance: 5000, countedCash: 5800,
      expectedCash: 5800, difference: 0, openedAt: WINDOW_DAY, closedAt: WINDOW_DAY },
  });

  // Movimientos manuales
  const txns: { type: 'INCOME' | 'EXPENSE'; amount: number; category: string; paymentMethod: string }[] = [
    { type: 'INCOME', amount: 2000, category: 'Inyección de caja', paymentMethod: 'EFECTIVO' },
    { type: 'INCOME', amount: 800, category: 'Venta otros', paymentMethod: 'TRANSFERENCIA' },
    { type: 'EXPENSE', amount: 1200, category: 'Sueldos', paymentMethod: 'EFECTIVO' },
    { type: 'EXPENSE', amount: 300, category: 'Sueldos', paymentMethod: 'TRANSFERENCIA' },
    { type: 'EXPENSE', amount: 500, category: 'Adelantos', paymentMethod: 'EFECTIVO' },
    { type: 'EXPENSE', amount: 250, category: 'Adelantos', paymentMethod: 'TARJETA' },
    { type: 'EXPENSE', amount: 700, category: 'Retiro en sobre', paymentMethod: 'EFECTIVO' },
    { type: 'EXPENSE', amount: 100, category: 'Gastos varios', paymentMethod: 'EFECTIVO' },
  ];
  await prisma.financeTransaction.createMany({
    data: txns.map((t) => ({
      cashRegisterId: register.id,
      type: t.type as any,
      amount: t.amount,
      category: t.category,
      paymentMethod: t.paymentMethod as any,
      createdAt: WINDOW_DAY,
    })),
  });

  try {
    const f = await getFinanceTotals(FROM, TO);
    console.log('\n=== Resultados getFinanceTotals (ventana 15/01/2099) ===');
    check('Caja ingresada (apertura)', f.cajaIngresada, 5000);
    check('Total efectivo ingresado', f.totalEfectivoIngresado, 3000); // 1000 venta + 2000 inyección
    check('Total virtual ingresado', f.totalVirtualIngresado, 2300);   // 1500 MP + 800 transf
    check('Gastos en efectivo', f.cashExpense, 2500);                  // 1200+500+700+100
    check('Gastos virtuales', f.virtualExpense, 550);                  // 300+250
    check('Sueldos efectivo', f.sueldosEfectivo, 1200);
    check('Sueldos virtual', f.sueldosVirtual, 300);
    check('Adelantos efectivo', f.adelantosEfectivo, 500);
    check('Adelantos virtual', f.adelantosVirtual, 250);
    check('Total sobres', f.sobres, 700);
    check('Total virtual (neto)', f.totalVirtualNeto, 1750);           // 2300-550
    check('Total caja (esperado)', f.totalCaja, 5500);                 // 5000+3000-2500
    check('Real en caja (arqueo)', f.realEnCaja, 5800);
    check('Clientes en efectivo', f.cantEfectivo, 1);
    check('Clientes en virtual', f.cantVirtual, 1);
    check('Total operaciones', f.totalOperaciones, 2);
  } finally {
    // Limpieza
    await prisma.financeTransaction.deleteMany({ where: { cashRegisterId: register.id } });
    await prisma.cashRegister.delete({ where: { id: register.id } });
    await prisma.order.deleteMany({ where: { id: { in: [orderCash.id, orderVirtual.id] } } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n=== ${pass} OK / ${fail} FALLOS ===`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('Error en la prueba:', e);
  await prisma.$disconnect();
  process.exit(1);
});
