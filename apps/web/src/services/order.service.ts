import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/event-bus';
import { emitOrderCreated, emitOrderStatusChanged, emitNotification, emitPrintOrder } from '@/lib/socket-server';
import { getOpenCashRegister } from '@/services/finance.service';
import { controlsStock } from '@/lib/constants';
import { isValidSlot } from '@/services/schedule.service';
import { getActiveAppDiscount, discountAmount } from '@/services/discount.service';
import { esDireccionUbicable } from '@/services/delivery-area.service';
import { sendText } from '@/lib/whatsapp';
import { sanitizePhone } from '@/lib/utils';
import type { CreateOrderInput, UpdateOrderStatusInput } from '@/lib/validators';
import type { OrderStatus, Prisma } from '@prisma/client';
import { format } from 'date-fns';

const ORDER_INCLUDE = {
  // role: para distinguir los pedidos que hace un cliente por la web de los
  // que carga el local (sonido y color propios en Pedidos).
  user: { select: { id: true, name: true, email: true, phone: true, role: true } },
  address: true,
  deliveryEmployee: { select: { id: true, firstName: true, lastName: true, phone: true } },
  items: {
    include: {
      product: true,
      promotion: true,
    },
  },
  payment: true,
} satisfies Prisma.OrderInclude;

/**
 * Ajusta el stock de las categorías que lo controlan (ver
 * STOCK_CONTROLLED_CATEGORY_SLUGS: postres y bebidas). El resto
 * (pizzas/empanadas/fainá) se hace al momento, se habilita a mano y no descuenta.
 *   - 'sell'    → descuenta (venta), sin bajar de 0.
 *   - 'restore' → devuelve al stock (cancelación de un pedido ya vendido).
 */
async function adjustStockForOrder(orderId: string, direction: 'sell' | 'restore') {
  const items = await prisma.orderItem.findMany({
    where: { orderId, productId: { not: null } },
    include: { product: { include: { category: true } } },
  });
  for (const it of items) {
    if (!it.productId || !it.product || !controlsStock(it.product.category?.slug)) continue;
    if (direction === 'sell') {
      const newStock = Math.max(0, it.product.stock - it.quantity);
      await prisma.product.update({ where: { id: it.productId }, data: { stock: newStock } });
    } else {
      await prisma.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.quantity } },
      });
    }
  }
}

/**
 * Valida que haya stock suficiente de los productos con control de stock. Lanza
 * si alguno no alcanza. No afecta a las demás categorías.
 */
async function assertStock(items: CreateOrderInput['items']) {
  const reqQty = new Map<string, number>();
  for (const i of items) {
    if (i.productId) reqQty.set(i.productId, (reqQty.get(i.productId) ?? 0) + i.quantity);
  }
  if (reqQty.size === 0) return;
  const products = await prisma.product.findMany({
    where: { id: { in: [...reqQty.keys()] } },
    include: { category: true },
  });
  for (const p of products) {
    if (!controlsStock(p.category?.slug)) continue;
    const qty = reqQty.get(p.id) ?? 0;
    if (qty > 0 && p.stock < qty) {
      throw new Error(`Sin stock suficiente de ${p.name} (quedan ${p.stock})`);
    }
  }
}

/**
 * Número de pedido. Con caja abierta lleva el prefijo del turno (TM = mañana,
 * TN = noche) y se reinicia por turno; sin caja abierta (p. ej. pedido online
 * fuera de turno) cae al formato por día.
 *   Ej: 20260710-TM001, 20260710-TN001, 20260710-0001
 *
 * La fecha es la de APERTURA de la caja, no la de hoy: un turno que arranca a
 * las 20:00 y sigue después de medianoche mantiene su numeración hasta que la
 * caja cierre, en vez de reiniciar a las 00:00 en medio del servicio.
 *
 * El próximo número se deriva del MÁXIMO sufijo ya usado para esa fecha+prefijo
 * (no de un count()): así no colisiona ante cancelaciones, huecos o sesiones
 * repetidas del mismo turno. Como igual no es atómico contra el insert, quien
 * llama debe reintentar ante una colisión por concurrencia (ver createOrder).
 */
async function generateOrderNumber(isTest: boolean): Promise<string> {
  const register = await getOpenCashRegister();
  const dateStr = format(register?.openedAt ?? new Date(), 'yyyyMMdd');
  // Simulación: prefijo TT, así se distingue del real y no pisa su numeración.
  const prefix = isTest ? 'TT' : register?.shift ? (register.shift === 'MANANA' ? 'TM' : 'TN') : '';
  const pad = prefix ? 3 : 4;
  const startsWith = `${dateStr}-${prefix}`;

  // Último número usado con esta fecha+prefijo. Calculamos el máximo SOLO sobre el
  // formato regular (fecha-prefijo + N dígitos al final): así los "agregados"
  // vinculados (#…-TM006-2), que comparten prefijo pero llevan un sufijo extra,
  // NO ensucian la numeración (romperían el slice y podrían colisionar).
  const rows = await prisma.order.findMany({
    where: prefix
      ? { orderNumber: { startsWith } }
      : // formato por día: excluir los de turno (que tienen "-T…").
        { orderNumber: { startsWith: `${dateStr}-` }, NOT: { orderNumber: { startsWith: `${dateStr}-T` } } },
    select: { orderNumber: true },
  });
  // \d+ y no \d{pad}: al pasar de 999 el número gana un dígito (TM1000) y con el
  // patrón de largo fijo dejaba de matchear, así que la cuenta volvía a empezar
  // de 1 y chocaba con los números ya usados.
  const re = prefix
    ? new RegExp(`-${prefix}(\\d+)$`)
    : new RegExp(`^${dateStr}-(\\d+)$`);
  let lastNum = 0;
  for (const r of rows) {
    const m = r.orderNumber.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > lastNum) lastNum = n;
    }
  }
  return `${startsWith}${String(lastNum + 1).padStart(pad, '0')}`;
}

/** ¿El error es una colisión de la restricción única de `orderNumber`? */
function isDuplicateOrderNumber(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || (e as { code?: string }).code !== 'P2002') return false;
  // meta.target puede ser ['orderNumber'] o el nombre del índice ("Order_orderNumber_key").
  return JSON.stringify((e as { meta?: { target?: unknown } }).meta?.target ?? '')
    .toLowerCase()
    .includes('ordernumber');
}

export async function getOrders(params?: {
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  page?: number;
  limit?: number;
  fromDate?: Date;
  toDate?: Date;
}) {
  const { userId, status, page = 1, limit = 20, fromDate, toDate } = params || {};

  const where: Prisma.OrderWhereInput = {};
  if (userId) where.userId = userId;
  if (status) where.status = Array.isArray(status) ? { in: status } : status;
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
}

export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({ where: { orderNumber }, include: ORDER_INCLUDE });
}

// El tiempo estimado ya NO se calcula solo: lo carga a mano el local desde la
// tarjeta del pedido, al confirmarlo. Seguimos guardando startedAt / finishedAt
// en cada pedido para, más adelante, poder estimarlo por tipo de pedido.

export async function createOrder(
  userId: string,
  data: CreateOrderInput,
  // Pedidos tomados desde el mostrador/admin: se confirman al instante y se
  // imprimen (cocina + comanda) apenas se cargan.
  options?: {
    printOnCreate?: boolean;
    confirmImmediately?: boolean;
    isTest?: boolean;
    // Número forzado (pedido "agregado" vinculado: #TM003-2). Si choca con la
    // restricción única, quien llama debe reintentar con el siguiente sufijo.
    explicitOrderNumber?: string;
    // Pedido hecho por un CLIENTE desde la web: le corresponde el descuento
    // general de la app (si hay uno activo). Los que carga el local, no.
    applyAppDiscount?: boolean;
  }
) {
  // Pedido de simulación (caja test): no controla ni descuenta stock real.
  const isTest = !!options?.isTest;

  // No permitir vender sin stock suficiente (postres y bebidas; el resto no controla).
  if (!isTest) await assertStock(data.items);

  // Pedido programado: validamos contra las franjas vigentes AHORA. El cliente
  // pudo dejar el checkout abierto un rato largo y la franja que eligió ya puede
  // haber pasado; en ese caso no lo dejamos pasar como si nada.
  let scheduledFor: Date | null = null;
  if (data.scheduledFor) {
    const when = new Date(data.scheduledFor);
    if (!(await isValidSlot(when))) {
      throw new Error('El horario que elegiste ya no está disponible. Elegí otro.');
    }
    scheduledFor = when;
  }

  // Para delivery sin addressId, creamos la dirección a partir de los datos inline.
  let addressId = data.addressId;
  // Una dirección elegida por id tiene que ser del que pide: viene del cliente,
  // así que no alcanza con que exista.
  if (addressId) {
    const suya = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!suya) addressId = undefined;
  }
  if (!addressId && data.deliveryType === 'DELIVERY' && data.address) {
    // Sin número solo se acepta si nombra un barrio/country cargado: al
    // repartidor le alcanza con el nombre, pero una calle sin altura no.
    if (!(await esDireccionUbicable(data.address.street, data.address.number))) {
      throw new Error(
        'Poné el número de la dirección, o elegí tu barrio cerrado de la lista.'
      );
    }
    const created = await prisma.address.create({
      data: {
        userId,
        street: data.address.street,
        number: data.address.number ?? '',
        apartment: data.address.apartment ?? null,
        city: data.address.city,
        state: data.address.state ?? '',
        reference: data.address.reference ?? null,
        // Solo se le vuelve a ofrecer si pidió guardarla.
        saved: !!data.saveAddress,
      },
    });
    addressId = created.id;
  }

  // Los pedidos de MercadoPago quedan "esperando pago" (ocultos de la cocina)
  // hasta que el pago se acredite (webhook o verificación activa). El resto
  // entra directo como RECIBIDO con su pago pendiente de cobro.
  const initialStatus: OrderStatus =
    data.paymentMethod === 'MERCADO_PAGO'
      ? 'PENDIENTE_PAGO'
      : options?.confirmImmediately
        ? 'CONFIRMADO'
        : 'RECIBIDO';

  // Pedidos Ya cobra la plataforma: el pedido nace pagado (nadie le cobra al
  // repartidor) y la venta cuenta como virtual, igual que tarjeta. La
  // transferencia NO: se marca cobrada a mano cuando se verifica que entró.
  const paid = data.paymentMethod === 'PEDIDOS_YA' ? true : !!data.paid;

  // Descuento de la app. Se calcula ACÁ y pisa lo que haya mandado el cliente:
  // el navegador no decide cuánta plata se descuenta. Si el front venía
  // desactualizado, el pedido sale igual con el número correcto.
  let discount = data.discount ?? 0;
  let total = data.total;
  let cashAmount = data.cashAmount;
  let transferAmount = data.transferAmount;
  if (options?.applyAppDiscount) {
    const promo = await getActiveAppDiscount();
    discount = promo ? discountAmount(data.subtotal, promo.percentage) : 0;
    total = Math.max(0, Math.round((data.subtotal + data.deliveryFee + (data.tip ?? 0) - discount) * 100) / 100);
    // El pago mixto se reparte sobre el total: si el descuento lo bajó, lo que
    // se ingresó puede pasarse. Respetamos el efectivo y ajustamos el resto.
    if (data.paymentMethod === 'MIXTO' && Math.abs((cashAmount ?? 0) + (transferAmount ?? 0) - total) >= 0.01) {
      cashAmount = Math.min(cashAmount ?? 0, total);
      transferAmount = Math.round((total - cashAmount) * 100) / 100;
    }
  }

  const orderData = (orderNumber: string) => ({
    orderNumber,
    userId,
    addressId,
    isTest,
    // El mostrador lo carga al tomar el pedido; los pedidos web nacen sin él y
    // se completa desde la tarjeta al confirmar.
    estimatedTime: data.estimatedTime ?? null,
    scheduledFor,
    // Inicio del pedido (para medir la demora real hasta la entrega).
    startedAt: new Date(),
    status: initialStatus,
    deliveryType: data.deliveryType,
    paymentMethod: data.paymentMethod,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    discount,
    tip: data.tip ?? 0,
    total,
    cashAmount: data.paymentMethod === 'MIXTO' ? cashAmount : null,
    transferAmount: data.paymentMethod === 'MIXTO' ? transferAmount : null,
    // "Paga con" solo aplica a pago en efectivo (para calcular el vuelto).
    cashReceived: data.paymentMethod === 'EFECTIVO' ? (data.cashReceived ?? null) : null,
    notes: data.notes,
    phone: data.phone,
    courierName: data.courierName ?? null,
    // Solo tiene sentido en Pedidos Ya, y solo si cargaron un monto: un 0 se
    // guarda como null para que no salga la línea en la comanda.
    pedidosYaExtra:
      data.deliveryType === 'PEDIDOS_YA' && (data.pedidosYaExtra ?? 0) > 0
        ? data.pedidosYaExtra
        : null,
    whatsappToken: data.whatsappToken,
    items: {
      create: data.items.map((item) => ({
        productId: item.productId,
        promotionId: item.promotionId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        notes: item.notes,
      })),
    },
    payment: {
      // Mostrador con "Pagó" marcado: el pago entra ya aprobado, así el ticket
      // de cocina imprime "PAGADO ✓" en vez de "FALTA COBRAR".
      create: {
        method: data.paymentMethod,
        status: (paid ? 'APPROVED' : 'PENDING') as 'APPROVED' | 'PENDING',
        amount: total,
        paidAt: paid ? new Date() : null,
      },
    },
  });

  // El número de pedido se calcula por fuera de una transacción, así que dos
  // altas casi simultáneas (doble click, dos cargas a la vez) podrían generar el
  // mismo número. Si el insert choca con la restricción única, regeneramos el
  // número y reintentamos, en vez de fallar con "Unique constraint failed".
  const createWithRetry = async () => {
    for (let attempt = 1; ; attempt++) {
      const orderNumber = options?.explicitOrderNumber ?? (await generateOrderNumber(isTest));
      try {
        return await prisma.order.create({ data: orderData(orderNumber), include: ORDER_INCLUDE });
      } catch (e) {
        // Con número forzado no reintentamos acá (no hay otro número que probar):
        // que lo maneje quien llama.
        if (!options?.explicitOrderNumber && isDuplicateOrderNumber(e) && attempt < 8) continue;
        throw e;
      }
    }
  };
  const order = await createWithRetry();

  await savePromotionComposition(order.id, data.items);
  await recordarTelefonoDelCliente(userId, data.phone);

  // Si está esperando pago (MercadoPago), no avisamos a la cocina todavía ni
  // descontamos stock: ambas cosas se disparan al acreditarse el pago
  // (ver promoteOrderAfterPayment).
  if (initialStatus !== 'PENDIENTE_PAGO') {
    // La simulación no toca el stock real.
    if (!isTest) await adjustStockForOrder(order.id, 'sell');
    notifyOrderReceived(order);
    // Pedidos de mostrador: imprimir cocina + comanda al crearlos.
    if (options?.printOnCreate) {
      emitPrintOrder(order.id);
    }
  }

  return order;
}

/**
 * Se queda con el teléfono que el cliente cargó en su primer pedido, así no lo
 * tiene que escribir cada vez (el checkout lo precarga desde la cuenta).
 *
 * Solo completa: si la cuenta ya tiene uno, no lo pisa — puede haberlo cambiado
 * a propósito desde el perfil, o este pedido puede ir a un teléfono de otra
 * persona. Best-effort: el teléfono es único por usuario y si ya lo tiene otra
 * cuenta no vale la pena romper el pedido por eso.
 *
 * SOLO para clientes: en los pedidos de mostrador el teléfono que se carga es el
 * DEL CLIENTE, no el de quien atiende, y se quedaba pegado a la cuenta de
 * mostrador/admin apareciendo precargado en el pedido siguiente.
 */
async function recordarTelefonoDelCliente(userId: string, phone?: string | null) {
  const limpio = phone?.trim();
  if (!limpio) return;
  try {
    await prisma.user.updateMany({
      where: { id: userId, role: 'CUSTOMER', OR: [{ phone: null }, { phone: '' }] },
      data: { phone: limpio },
    });
  } catch (e) {
    console.warn('[order] no se pudo guardar el teléfono del cliente:', e instanceof Error ? e.message : e);
  }
}

/**
 * Guarda QUÉ productos llevó cada promoción del pedido: los fijos (según la
 * definición de la promo en ese momento) y los que eligió el cliente.
 *
 * Es solo composición para reportes y compras: no toca precios ni totales, que
 * los sigue llevando el OrderItem de la promo. Si falla, no rompemos el pedido:
 * perder una estadística no justifica perder una venta.
 */
async function savePromotionComposition(orderId: string, items: CreateOrderInput['items']) {
  const promoItems = items.filter((i) => i.promotionId);
  if (!promoItems.length) return;

  try {
    // Componentes fijos declarados en cada promo.
    const promotionIds = [...new Set(promoItems.map((i) => i.promotionId!))];
    const fixed = await prisma.promotionItem.findMany({
      where: { promotionId: { in: promotionIds } },
      select: { promotionId: true, productId: true, quantity: true },
    });

    const rows: { orderId: string; promotionId: string; productId: string; quantity: number; chosen: boolean }[] = [];
    for (const item of promoItems) {
      const promotionId = item.promotionId!;
      // Si se llevaron 2 promos iguales, la composición va por 2.
      const times = Math.max(1, item.quantity);

      for (const f of fixed.filter((f) => f.promotionId === promotionId)) {
        rows.push({ orderId, promotionId, productId: f.productId, quantity: f.quantity * times, chosen: false });
      }
      for (const c of item.promoChoices ?? []) {
        rows.push({ orderId, promotionId, productId: c.productId, quantity: c.quantity * times, chosen: true });
      }
    }

    if (rows.length) await prisma.orderPromotionItem.createMany({ data: rows });
  } catch (e) {
    console.error('[order] no se pudo guardar la composición de la promo:', e instanceof Error ? e.message : e);
  }
}

/** Aviso de "nuevo pedido" a la cocina (tiempo real + notificación persistida). */
async function notifyOrderReceived(order: Awaited<ReturnType<typeof getOrderById>>) {
  if (!order) return;
  emitOrderCreated(order);
  emitNotification({
    title: 'Nuevo pedido',
    body: `Pedido #${order.orderNumber} de ${order.user.name || 'Cliente'}`,
    type: 'order:new',
  });
  await prisma.notification.create({
    data: {
      type: 'ORDER_CREATED',
      title: 'Nuevo pedido recibido',
      body: `Pedido #${order.orderNumber} - Total: $${order.total}`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
    },
  });
  eventBus.emit('order:created', order as never);
}

/**
 * Promueve un pedido que estaba esperando pago (MercadoPago) a RECIBIDO cuando
 * el pago se acredita, y recién ahí avisa a la cocina. Idempotente: si el pedido
 * ya no está en PENDIENTE_PAGO, no hace nada.
 */
export async function promoteOrderAfterPayment(orderId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return null;
  if (existing.status !== 'PENDIENTE_PAGO') return existing;

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'RECIBIDO' },
    include: ORDER_INCLUDE,
  });

  // Recién ahora (pago acreditado) descontamos el stock.
  await adjustStockForOrder(orderId, 'sell');
  await notifyOrderReceived(order);
  emitOrderStatusChanged(orderId, 'RECIBIDO', order);
  eventBus.emit('order:status_changed', order as never);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  data: UpdateOrderStatusInput,
  actorId?: string
) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error('Pedido no encontrado');

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: data.status,
      estimatedTime: data.estimatedTime,
      // Marca de fin cuando se entrega (una sola vez), para medir la demora real.
      ...(data.status === 'ENTREGADO' && !existing.finishedAt ? { finishedAt: new Date() } : {}),
    },
    include: ORDER_INCLUDE,
  });

  // Al cancelar un pedido que ya había descontado stock (todo menos los que
  // seguían en PENDIENTE_PAGO, que nunca descontaron), devolvemos el stock.
  if (
    data.status === 'CANCELADO' &&
    existing.status !== 'CANCELADO' &&
    existing.status !== 'PENDIENTE_PAGO'
  ) {
    await adjustStockForOrder(orderId, 'restore');
  }

  if (actorId) {
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE_STATUS',
        entity: 'Order',
        entityId: orderId,
        oldValues: { status: existing.status },
        newValues: { status: data.status },
      },
    });
  }

  // Al pasar a "en reparto", avisamos al cliente por WhatsApp (best-effort).
  if (data.status === 'EN_REPARTO') {
    const clientPhone = order.phone || order.user.phone;
    if (clientPhone) {
      const driverName = order.deliveryEmployee
        ? `${order.deliveryEmployee.firstName} ${order.deliveryEmployee.lastName}`
        : null;
      const msg =
        `🛵 ¡Tu pedido #${order.orderNumber} está en camino!` +
        (driverName ? `\nRepartidor: ${driverName}.` : '') +
        `\n¡Gracias por tu compra!`;
      try {
        await sendText(sanitizePhone(clientPhone), msg);
      } catch (err) {
        console.warn('[updateOrderStatus] No se pudo enviar WhatsApp al cliente:', err);
      }
    }
  }

  // Al confirmar el pedido, disparamos la impresión de los tickets en la
  // estación de impresión (cocina + comanda).
  if (data.status === 'CONFIRMADO') {
    emitPrintOrder(orderId);
  }

  // Mandamos también el tiempo estimado: si el local acaba de cargarlo, el
  // cliente que está mirando su pedido lo ve al instante.
  emitOrderStatusChanged(orderId, data.status, order, order.estimatedTime);
  eventBus.emit('order:status_changed', order as never);

  return order;
}

/**
 * Registra el cobro de un pedido. Si se pasa `details`, fija el tipo de ingreso
 * real (efectivo / transferencia / mixto) — sirve para pedidos "Paga al retirar"
 * y también para corregir el medio si el cliente cambió de forma de pago.
 */
export async function markOrderPaid(
  orderId: string,
  actorId?: string,
  details?: { method?: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MIXTO'; cashAmount?: number; transferAmount?: number }
) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!existing) throw new Error('Pedido no encontrado');
  // Solo se cobra/ajusta el medio en pedidos que todavía no están pagados.
  if (existing.payment?.status === 'APPROVED') {
    throw new Error('El pedido ya está pagado');
  }

  if (details?.method === 'MIXTO') {
    const cash = details.cashAmount ?? 0;
    const transfer = details.transferAmount ?? 0;
    if (Math.abs(cash + transfer - Number(existing.total)) >= 0.01) {
      throw new Error('El efectivo y la transferencia deben sumar el total');
    }
  }

  // Si se indicó el tipo de ingreso, actualizamos el medio de pago del pedido.
  const effectiveMethod = details?.method ?? existing.paymentMethod;
  if (details?.method) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: details.method,
        cashAmount: details.method === 'MIXTO' ? details.cashAmount : null,
        transferAmount: details.method === 'MIXTO' ? details.transferAmount : null,
      },
    });
  }

  if (existing.payment) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'APPROVED', method: effectiveMethod, paidAt: existing.payment.paidAt ?? new Date() },
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId,
        method: effectiveMethod,
        status: 'APPROVED',
        amount: existing.total,
        paidAt: new Date(),
      },
    });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });

  if (actorId) {
    await prisma.auditLog.create({
      data: { userId: actorId, action: 'MARK_PAID', entity: 'Order', entityId: orderId },
    });
  }

  if (order) {
    emitOrderStatusChanged(orderId, order.status, order);
    eventBus.emit('order:status_changed', order as never);
  }

  return order;
}

/**
 * Cambia el método de pago de un pedido YA cobrado (p. ej. se marcó efectivo y
 * en realidad fue tarjeta). Actualiza el pedido y el pago; impacta en reportes
 * porque el desglose efectivo/virtual se calcula por el método del pedido.
 */
export async function changeOrderPaymentMethod(
  orderId: string,
  details: { method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MIXTO'; cashAmount?: number; transferAmount?: number },
  actorId?: string
) {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!existing) throw new Error('Pedido no encontrado');

  if (details.method === 'MIXTO') {
    const cash = details.cashAmount ?? 0;
    const transfer = details.transferAmount ?? 0;
    if (Math.abs(cash + transfer - Number(existing.total)) >= 0.01) {
      throw new Error('El efectivo y la transferencia deben sumar el total');
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentMethod: details.method,
      cashAmount: details.method === 'MIXTO' ? details.cashAmount : null,
      transferAmount: details.method === 'MIXTO' ? details.transferAmount : null,
    },
  });
  if (existing.payment) {
    await prisma.payment.update({ where: { orderId }, data: { method: details.method } });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (actorId) {
    await prisma.auditLog.create({
      data: { userId: actorId, action: 'CHANGE_PAYMENT_METHOD', entity: 'Order', entityId: orderId },
    });
  }
  if (order) {
    emitOrderStatusChanged(orderId, order.status, order);
    eventBus.emit('order:status_changed', order as never);
  }
  return order;
}

/**
 * Asigna un repartidor a un pedido de delivery. El aviso al cliente "en camino"
 * NO se envía acá, sino al pasar el pedido a EN_REPARTO (ver updateOrderStatus).
 */
export async function assignDeliveryEmployee(
  orderId: string,
  employeeId: string,
  actorId?: string
) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.role !== 'REPARTIDOR') {
    throw new Error('El empleado seleccionado no es un repartidor válido');
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { deliveryEmployeeId: employeeId },
    include: ORDER_INCLUDE,
  });

  if (actorId) {
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'ASSIGN_DELIVERY',
        entity: 'Order',
        entityId: orderId,
        newValues: { deliveryEmployeeId: employeeId },
      },
    });
  }

  emitOrderStatusChanged(orderId, order.status, order);
  eventBus.emit('order:status_changed', order as never);

  return order;
}

/**
 * Cancela los pedidos de MercadoPago que quedaron esperando pago (PENDIENTE_PAGO)
 * y nunca se acreditaron, pasado `maxAgeMinutes`. SOLO afecta a PENDIENTE_PAGO
 * (estado exclusivo de MercadoPago): los pedidos de efectivo/transferencia entran
 * como RECIBIDO y nunca se tocan acá. Como un pago acreditado promueve el pedido
 * a RECIBIDO, jamás se cancela un pedido realmente pagado.
 */
export async function cancelStaleUnpaidMercadoPagoOrders(maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDIENTE_PAGO',
      createdAt: { lt: cutoff },
      payment: { is: { status: { not: 'APPROVED' } } },
    },
    select: { id: true },
  });
  if (stale.length === 0) return { cancelled: 0 };

  const ids = stale.map((o) => o.id);
  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { status: 'CANCELADO' },
  });
  for (const id of ids) {
    eventBus.emit('order:status_changed', { id, status: 'CANCELADO' } as never);
  }
  return { cancelled: ids.length };
}

/**
 * Cancelación por parte del cliente. Solo se permite si el pedido es suyo y
 * está en PENDIENTE_PAGO (todavía no pagó / no entró a cocina).
 */
/**
 * Estados en los que el cliente todavía puede cancelar solo: mientras espera el
 * pago y mientras el local no lo confirmó. Después ya se está cocinando, así que
 * tiene que llamar y lo cancela el local.
 */
export const CUSTOMER_CANCELABLE: OrderStatus[] = ['PENDIENTE_PAGO', 'RECIBIDO'];

export async function cancelPendingPaymentOrder(orderId: string, userId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error('Pedido no encontrado');
  if (existing.userId !== userId) throw new Error('No autorizado');
  if (!CUSTOMER_CANCELABLE.includes(existing.status)) {
    throw new Error('El pedido ya está en preparación: llamanos para cancelarlo');
  }

  // Un pedido PENDIENTE_PAGO nunca descontó stock (se descuenta al acreditarse
  // el pago), así que solo devolvemos el de los que sí lo hicieron.
  if (existing.status !== 'PENDIENTE_PAGO') {
    await adjustStockForOrder(orderId, 'restore');
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELADO' },
    include: ORDER_INCLUDE,
  });
  emitOrderStatusChanged(orderId, 'CANCELADO', order);
  eventBus.emit('order:status_changed', order as never);
  return order;
}

/**
 * Cambio del método de pago por parte del cliente. Pensado para pedidos de
 * RETIRO EN LOCAL todavía no pagados: permite alternar entre efectivo y
 * transferencia (los medios que se abonan en el local / por transferencia).
 */
export async function changePickupPaymentMethod(
  orderId: string,
  userId: string,
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA'
) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!existing) throw new Error('Pedido no encontrado');
  if (existing.userId !== userId) throw new Error('No autorizado');
  if (existing.deliveryType !== 'PICKUP') {
    throw new Error('Solo se puede cambiar el pago en pedidos de retiro en local');
  }
  if (existing.status === 'CANCELADO' || existing.status === 'ENTREGADO') {
    throw new Error('El pedido ya está cerrado');
  }
  if (existing.payment?.status === 'APPROVED') {
    throw new Error('El pedido ya está pagado');
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    // Al volver a un medio simple limpiamos el reparto del pago mixto.
    data: { paymentMethod, cashAmount: null, transferAmount: null },
    include: ORDER_INCLUDE,
  });

  // Misma regla que al crear: la transferencia entra como cobrada y el local
  // verifica después. Sin esto, cambiar el medio dejaba un pedido de
  // transferencia figurando como pendiente en la comanda.
  if (paymentMethod === 'TRANSFERENCIA') {
    await prisma.payment.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'APPROVED', paidAt: new Date() },
    });
  }
  emitOrderStatusChanged(orderId, order.status, order);
  eventBus.emit('order:status_changed', order as never);
  return order;
}

export async function getActiveOrders() {
  return prisma.order.findMany({
    where: {
      status: {
        notIn: ['PENDIENTE_PAGO', 'ENTREGADO', 'CANCELADO'],
      },
    },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}
