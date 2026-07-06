import { PrismaClient, Role, PaymentMethod, DeliveryType, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const customerPassword = await bcrypt.hash('cliente123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pizzeria.com' },
    update: {},
    create: {
      email: 'admin@pizzeria.com',
      name: 'Administrador',
      password: adminPassword,
      role: Role.ADMIN,
      phone: '+5491100000000',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'cliente@example.com' },
    update: {},
    create: {
      email: 'cliente@example.com',
      name: 'Cliente Demo',
      password: customerPassword,
      role: Role.CUSTOMER,
      phone: '+5491112345678',
    },
  });

  console.log('✅ Users created');

  // ─── Address ──────────────────────────────────────────────────────────────
  await prisma.address.upsert({
    where: { id: 'seed-address-1' },
    update: {},
    create: {
      id: 'seed-address-1',
      userId: customer.id,
      street: 'Av. Corrientes',
      number: '1234',
      apartment: '5B',
      city: 'Buenos Aires',
      state: 'CABA',
      zipCode: 'C1043',
      isDefault: true,
    },
  });

  console.log('✅ Addresses created');

  // ─── Categories ───────────────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'pizzas' },
      update: {},
      create: { name: 'Pizzas', slug: 'pizzas', icon: '🍕', sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'empanadas' },
      update: {},
      create: { name: 'Empanadas', slug: 'empanadas', icon: '🥟', sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'bebidas' },
      update: {},
      create: { name: 'Bebidas', slug: 'bebidas', icon: '🥤', sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'postres' },
      update: {},
      create: { name: 'Postres', slug: 'postres', icon: '🍰', sortOrder: 4 },
    }),
  ]);

  const [catPizzas, catEmpanadas, catBebidas, catPostres] = categories;
  console.log('✅ Categories created');

  // ─── Products ─────────────────────────────────────────────────────────────
  const pizzas = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-muzzarella' },
      update: { priceSmall: 6500, priceMedium: 11000, priceLarge: 13000 },
      create: {
        id: 'prod-muzzarella',
        name: 'Muzzarella',
        description: 'Salsa de tomate, mozzarella fresca y albahaca.',
        price: 13000,
        categoryId: catPizzas.id,
        stock: 50,
        available: true,
        priceSmall: 6500,
        priceMedium: 11000,
        priceLarge: 13000,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-napolitana' },
      update: { priceSmall: 8000, priceMedium: 14000, priceLarge: 18000 },
      create: {
        id: 'prod-napolitana',
        name: 'Napolitana',
        description: 'Salsa de tomate, mozzarella, tomate en rodajas y ajo.',
        price: 18000,
        categoryId: catPizzas.id,
        stock: 50,
        available: true,
        priceSmall: 8000,
        priceMedium: 14000,
        priceLarge: 18000,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-fugazzeta' },
      update: { priceSmall: 9000, priceMedium: 16000, priceLarge: 20000 },
      create: {
        id: 'prod-fugazzeta',
        name: 'Fugazzeta',
        description: 'Masa gruesa, mozzarella cubierta con cebolla y aceitunas.',
        price: 20000,
        categoryId: catPizzas.id,
        stock: 30,
        available: true,
        priceSmall: 9000,
        priceMedium: 16000,
        priceLarge: 20000,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-especial' },
      update: { priceSmall: 12000, priceMedium: 22000, priceLarge: 27000 },
      create: {
        id: 'prod-especial',
        name: 'Especial de la Casa',
        description: 'Salsa, mozzarella, jamón, morrones, aceitunas y huevo.',
        price: 27000,
        categoryId: catPizzas.id,
        stock: 30,
        available: true,
        priceSmall: 12000,
        priceMedium: 22000,
        priceLarge: 27000,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-calabresa' },
      update: { priceSmall: 10000, priceMedium: 18000, priceLarge: 22000 },
      create: {
        id: 'prod-calabresa',
        name: 'Calabresa',
        description: 'Salsa de tomate, mozzarella y chorizo calabrés.',
        price: 22000,
        categoryId: catPizzas.id,
        stock: 30,
        available: true,
        priceSmall: 10000,
        priceMedium: 18000,
        priceLarge: 22000,
      },
    }),
  ]);

  const empanadas = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-emp-carne' },
      update: {},
      create: {
        id: 'prod-emp-carne',
        name: 'Empanada de Carne',
        description: 'Relleno de carne picada con cebolla, huevo duro y aceitunas.',
        price: 450,
        categoryId: catEmpanadas.id,
        stock: 100,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-emp-pollo' },
      update: {},
      create: {
        id: 'prod-emp-pollo',
        name: 'Empanada de Pollo',
        description: 'Relleno de pollo desmenuzado con verduras.',
        price: 450,
        categoryId: catEmpanadas.id,
        stock: 100,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-emp-jamon' },
      update: {},
      create: {
        id: 'prod-emp-jamon',
        name: 'Empanada de Jamón y Queso',
        description: 'Relleno de jamón cocido y queso cremoso.',
        price: 450,
        categoryId: catEmpanadas.id,
        stock: 100,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-emp-verdura' },
      update: {},
      create: {
        id: 'prod-emp-verdura',
        name: 'Empanada de Verdura',
        description: 'Relleno de espinaca, ricota y queso.',
        price: 420,
        categoryId: catEmpanadas.id,
        stock: 100,
        available: true,
      },
    }),
  ]);

  const bebidas = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-coca-cola' },
      update: {},
      create: {
        id: 'prod-coca-cola',
        name: 'Coca-Cola 1.5L',
        description: 'Gaseosa Coca-Cola botella 1.5 litros.',
        price: 900,
        categoryId: catBebidas.id,
        stock: 200,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-sprite' },
      update: {},
      create: {
        id: 'prod-sprite',
        name: 'Sprite 1.5L',
        description: 'Gaseosa Sprite botella 1.5 litros.',
        price: 900,
        categoryId: catBebidas.id,
        stock: 200,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-agua' },
      update: {},
      create: {
        id: 'prod-agua',
        name: 'Agua Mineral 500ml',
        description: 'Agua mineral sin gas.',
        price: 400,
        categoryId: catBebidas.id,
        stock: 200,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-cerveza' },
      update: {},
      create: {
        id: 'prod-cerveza',
        name: 'Cerveza 1L',
        description: 'Cerveza artesanal rubia 1 litro.',
        price: 1400,
        categoryId: catBebidas.id,
        stock: 100,
        available: true,
      },
    }),
  ]);

  const postres = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-tiramisu' },
      update: {},
      create: {
        id: 'prod-tiramisu',
        name: 'Tiramisú',
        description: 'Postre clásico italiano con mascarpone y café.',
        price: 1200,
        categoryId: catPostres.id,
        stock: 20,
        available: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-panacotta' },
      update: {},
      create: {
        id: 'prod-panacotta',
        name: 'Panna Cotta',
        description: 'Panna cotta con coulis de frutos rojos.',
        price: 1100,
        categoryId: catPostres.id,
        stock: 20,
        available: true,
      },
    }),
  ]);

  console.log('✅ Products created');

  // ─── Promotions ───────────────────────────────────────────────────────────
  const promo1 = await prisma.promotion.upsert({
    where: { id: 'promo-combo-familiar' },
    update: {},
    create: {
      id: 'promo-combo-familiar',
      name: 'Combo Familiar',
      description: '2 Pizzas Muzzarella + 1 Gaseosa 1.5L',
      promotionalPrice: 6000,
      available: true,
    },
  });

  await prisma.promotionItem.upsert({
    where: { id: 'pi-1' },
    update: {},
    create: {
      id: 'pi-1',
      promotionId: promo1.id,
      productId: pizzas[0].id,
      quantity: 2,
    },
  });

  await prisma.promotionItem.upsert({
    where: { id: 'pi-2' },
    update: {},
    create: {
      id: 'pi-2',
      promotionId: promo1.id,
      productId: bebidas[0].id,
      quantity: 1,
    },
  });

  const promo2 = await prisma.promotion.upsert({
    where: { id: 'promo-docena-empanadas' },
    update: {},
    create: {
      id: 'promo-docena-empanadas',
      name: 'Docena de Empanadas',
      description: '12 Empanadas a elección',
      promotionalPrice: 4800,
      available: true,
    },
  });

  await prisma.promotionItem.upsert({
    where: { id: 'pi-3' },
    update: {},
    create: {
      id: 'pi-3',
      promotionId: promo2.id,
      productId: empanadas[0].id,
      quantity: 12,
    },
  });

  const promo3 = await prisma.promotion.upsert({
    where: { id: 'promo-pizza-cerveza' },
    update: {},
    create: {
      id: 'promo-pizza-cerveza',
      name: 'Pizza + Birra',
      description: '1 Pizza Especial + 1 Cerveza 1L',
      promotionalPrice: 4800,
      available: true,
    },
  });

  await prisma.promotionItem.upsert({
    where: { id: 'pi-4' },
    update: {},
    create: {
      id: 'pi-4',
      promotionId: promo3.id,
      productId: pizzas[3].id,
      quantity: 1,
    },
  });

  await prisma.promotionItem.upsert({
    where: { id: 'pi-5' },
    update: {},
    create: {
      id: 'pi-5',
      promotionId: promo3.id,
      productId: bebidas[3].id,
      quantity: 1,
    },
  });

  console.log('✅ Promotions created');

  // ─── Business Hours ───────────────────────────────────────────────────────
  const days = [0, 1, 2, 3, 4, 5, 6];
  for (const day of days) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: day },
      update: {},
      create: {
        dayOfWeek: day,
        openTime: '18:00',
        closeTime: '00:00',
        isOpen: true,
      },
    });
  }

  console.log('✅ Business hours created');

  // ─── Shipment Zones ───────────────────────────────────────────────────────
  const zone1 = await prisma.shipmentZone.upsert({
    where: { id: 'zone-1' },
    update: {},
    create: {
      id: 'zone-1',
      name: 'Zona Centro',
      radiusKm: 2,
      available: true,
    },
  });

  const zone2 = await prisma.shipmentZone.upsert({
    where: { id: 'zone-2' },
    update: {},
    create: {
      id: 'zone-2',
      name: 'Zona Norte',
      radiusKm: 5,
      available: true,
    },
  });

  const zone3 = await prisma.shipmentZone.upsert({
    where: { id: 'zone-3' },
    update: {},
    create: {
      id: 'zone-3',
      name: 'Zona Sur',
      radiusKm: 8,
      available: true,
    },
  });

  console.log('✅ Shipment zones created');

  // ─── Delivery Fees ────────────────────────────────────────────────────────
  await prisma.deliveryFee.upsert({
    where: { id: 'fee-default' },
    update: {},
    create: {
      id: 'fee-default',
      name: 'Envío gratuito (retiro en local)',
      fee: 0,
      isDefault: true,
    },
  });

  await prisma.deliveryFee.upsert({
    where: { id: 'fee-zona-1' },
    update: {},
    create: {
      id: 'fee-zona-1',
      shipmentZoneId: zone1.id,
      name: 'Envío Zona Centro',
      fee: 500,
      minOrderAmount: 2000,
    },
  });

  await prisma.deliveryFee.upsert({
    where: { id: 'fee-zona-2' },
    update: {},
    create: {
      id: 'fee-zona-2',
      shipmentZoneId: zone2.id,
      name: 'Envío Zona Norte',
      fee: 800,
      minOrderAmount: 2500,
    },
  });

  await prisma.deliveryFee.upsert({
    where: { id: 'fee-zona-3' },
    update: {},
    create: {
      id: 'fee-zona-3',
      shipmentZoneId: zone3.id,
      name: 'Envío Zona Sur',
      fee: 1200,
      minOrderAmount: 3000,
    },
  });

  console.log('✅ Delivery fees created');

  // ─── Sample Order ─────────────────────────────────────────────────────────
  const sampleOrder = await prisma.order.upsert({
    where: { orderNumber: '20240101-0001' },
    update: {},
    create: {
      orderNumber: '20240101-0001',
      userId: customer.id,
      status: OrderStatus.ENTREGADO,
      deliveryType: DeliveryType.DELIVERY,
      paymentMethod: PaymentMethod.EFECTIVO,
      subtotal: 5600,
      deliveryFee: 500,
      total: 6100,
      phone: '+5491112345678',
      items: {
        create: [
          {
            productId: pizzas[0].id,
            quantity: 2,
            unitPrice: 2800,
            subtotal: 5600,
          },
        ],
      },
      payment: {
        create: {
          method: PaymentMethod.EFECTIVO,
          status: 'APPROVED',
          amount: 6100,
          paidAt: new Date(),
        },
      },
    },
  });

  console.log('✅ Sample order created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Credentials:');
  console.log('  Admin:    admin@pizzeria.com / admin123');
  console.log('  Customer: cliente@example.com / cliente123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
