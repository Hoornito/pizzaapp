/**
 * Une las cuentas duplicadas por mayúsculas en el email ("Jorge@gmail.com" y
 * "jorge@gmail.com") y deja todos los emails en minúsculas.
 *
 * De cada grupo se queda la cuenta MÁS ANTIGUA (la que tiene el historial). A
 * esa se le pasan los pedidos, direcciones, dispositivos y el enlace con Google
 * de las otras, se completan los datos que le falten (teléfono, foto, nombre) y
 * las otras se borran.
 *
 * Por defecto sólo MUESTRA lo que haría. Para aplicarlo, con --apply. En el
 * servidor (dentro del contenedor de la app):
 *   docker compose -f docker-compose.prod.yml exec app npx tsx scripts/merge-duplicate-emails.ts
 *   docker compose -f docker-compose.prod.yml exec app npx tsx scripts/merge-duplicate-emails.ts --apply
 */
import { prisma } from '@/lib/prisma';

const APPLY = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, phone: true, image: true, password: true,
      emailVerified: true, role: true, createdAt: true,
      cart: { select: { id: true } },
      employee: { select: { id: true } },
      _count: { select: { orders: true, accounts: true, addresses: true } },
    },
  });

  const groups = new Map<string, typeof users>();
  for (const u of users) {
    const key = u.email!.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) || []), u]);
  }

  let merged = 0;
  for (const [email, group] of groups) {
    if (group.length < 2) continue;
    const [keeper, ...dups] = group; // el más antiguo primero (orderBy createdAt)
    console.log(`\n${email}`);
    for (const u of group) {
      console.log(
        `  ${u === keeper ? 'QUEDA ' : 'SE UNE'} ${u.id} "${u.email}" ${u.role} ` +
          `creada ${u.createdAt.toISOString().slice(0, 10)} · tel ${u.phone || '-'} · ` +
          `${u._count.orders} pedidos · ${u._count.accounts} login social · clave ${u.password ? 'sí' : 'no'}`
      );
    }
    if (dups.some((d) => d.role !== 'CUSTOMER')) {
      console.log('  ⚠ Hay una cuenta del personal en el grupo: se saltea, revisarlo a mano.');
      continue;
    }
    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const fill: Record<string, unknown> = {};
      for (const d of dups) {
        const ids = { userId: d.id };
        await tx.order.updateMany({ where: ids, data: { userId: keeper.id } });
        await tx.order.updateMany({ where: { cancelledById: d.id }, data: { cancelledById: keeper.id } });
        await tx.address.updateMany({ where: ids, data: { userId: keeper.id } });
        await tx.account.updateMany({ where: ids, data: { userId: keeper.id } });
        await tx.pushDevice.updateMany({ where: ids, data: { userId: keeper.id } });
        await tx.notification.updateMany({ where: ids, data: { userId: keeper.id } });
        await tx.auditLog.updateMany({ where: ids, data: { userId: keeper.id } });
        if (d.employee && !keeper.employee) {
          await tx.employee.update({ where: { id: d.employee.id }, data: { userId: keeper.id } });
        }
        // Un solo carrito por cuenta: si la que queda no tiene, hereda el del duplicado.
        if (d.cart && !keeper.cart) {
          await tx.cart.update({ where: { id: d.cart.id }, data: { userId: keeper.id } });
        }
        if (!keeper.phone && d.phone && !fill.phone) fill.phone = d.phone;
        if (!keeper.image && d.image && !fill.image) fill.image = d.image;
        if (!keeper.name && d.name && !fill.name) fill.name = d.name;
        if (!keeper.password && d.password && !fill.password) fill.password = d.password;
        if (!keeper.emailVerified && d.emailVerified && !fill.emailVerified) fill.emailVerified = d.emailVerified;
      }
      // Primero se borran los duplicados: el teléfono y el email son únicos.
      await tx.user.deleteMany({ where: { id: { in: dups.map((d) => d.id) } } });
      await tx.user.update({ where: { id: keeper.id }, data: { ...fill, email } });
    });
    merged += dups.length;
  }

  // El resto de las cuentas: email en minúsculas (ya no puede chocar con nadie).
  const toLower = users.filter((u) => u.email !== u.email!.trim().toLowerCase() && groups.get(u.email!.trim().toLowerCase())!.length === 1);
  console.log(`\n${toLower.length} cuenta(s) más con mayúsculas en el email, se pasan a minúsculas.`);
  if (APPLY) {
    for (const u of toLower) {
      await prisma.user.update({ where: { id: u.id }, data: { email: u.email!.trim().toLowerCase() } });
    }
  }

  console.log(APPLY ? `\nListo: ${merged} cuenta(s) unida(s).` : '\nSólo vista previa. Para aplicarlo: agregar --apply');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
