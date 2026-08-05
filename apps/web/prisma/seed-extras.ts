/**
 * Crea la categoría interna "Agregados" (slug `extras`) con los agregados más
 * comunes, en $0. NO se muestra en el menú del cliente: sirve para que el bot de
 * WhatsApp le ponga precio solo al extra de un ítem ("muzza con huevo").
 *
 * Un agregado en $0 se comporta como hasta ahora (el chat pasa a 🔴 y una persona
 * le pone el precio), así que es seguro correrlo y cargar los precios después
 * desde /admin/products.
 *
 * Uso:  npm run db:extras   (idempotente: no pisa precios ya cargados)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXTRAS_SLUG = 'extras';

const EXTRAS = [
  'Huevo',
  'Jamón',
  'Panceta',
  'Doble muzzarella',
  'Queso',
  'Roquefort',
  'Provolone',
  'Morrón',
  'Cebolla',
  'Tomate',
  'Aceitunas',
  'Rúcula',
  'Ananá',
  'Choclo',
  'Salame',
  'Anchoas',
];

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: EXTRAS_SLUG },
    update: {},
    create: {
      name: 'Agregados',
      slug: EXTRAS_SLUG,
      description: 'Agregados que se cobran aparte (uso interno: no se muestran en el menú)',
      icon: '➕',
      sortOrder: 99,
    },
  });

  let created = 0;
  for (const name of EXTRAS) {
    const existing = await prisma.product.findFirst({ where: { categoryId: category.id, name } });
    if (existing) continue;
    await prisma.product.create({
      data: { name, price: 0, categoryId: category.id, available: true, stock: 0 },
    });
    created++;
  }

  const all = await prisma.product.findMany({
    where: { categoryId: category.id },
    orderBy: { name: 'asc' },
  });
  const sinPrecio = all.filter((p) => Number(p.price) <= 0);

  console.log(`✅ Categoría "${category.name}" lista (${all.length} agregados, ${created} nuevos)`);
  if (sinPrecio.length) {
    console.log(
      `⚠️  ${sinPrecio.length} sin precio (el bot los sigue derivando a una persona): ` +
        sinPrecio.map((p) => p.name).join(', ')
    );
    console.log('   Cargá los precios en /admin/products (categoría Agregados).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
