import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/event-bus';
import { emitOrderCreated, emitOrderStatusChanged, emitNotification, emitPrintOrder } from '@/lib/socket-server';
import { getOpenCashRegister } from '@/services/finance.service';
import { sendText } from '@/lib/whatsapp';
import { sanitizePhone } from '@/lib/utils';
import type { CreateOrderInput, UpdateOrderStatusInput } from '@/lib/validators';
import type { OrderStatus, Prisma } from '@prisma/client';
import { format } from 'date-fns';

const ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
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
 * Ajusta el stock de los POSTRES de un pedido. Solo la categoría "postres" lleva
 * control de stock; el resto (pizzas/empanadas/bebidas) se habilita/deshabilita
 * a mano y no descuenta.
 *   - 'sell'    → descuenta (venta), sin bajar de 0.
 *   - 'restore' → devuelve al stock (cancelación de un pedido ya vendido).
 */
async function adjustPostresStockForOrder(orderId: string, direction: 'sell' | 'restore') {
  const items = await prisma.orderItem.findMany({
    where: { orderId, productId: { not: null } },
    include: { product: { include: { category: true } } },
  });
  for (const it of items) {
    if (!it.productId || it.product?.category?.slug !== 'postres') continue;
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
 * Valida que haya stock suficiente de los POSTRES pedidos. Lanza si algún postre
 * no alcanza. No afecta a las demás categorías.
 */
async function assertPostresStock(items: CreateOrderInput['items']) {
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
    if (p.category?.slug !== 'postres') continue;
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
 * El próximo número se deriva del MÁXIMO sufijo ya usado para esa fecha+prefijo
 * (no de un count()): así no colisiona ante cancelaciones, huecos o sesiones
 * repetidas del mismo turno. Como igual no es atómico contra el insert, quien
 * llama debe reintentar ante una colisión por concurrencia (ver createOrder).
 */
async function generateOrderNumber(isTest: boolean): Promise<string> {
  const today = new Date();
  const dateStr = format(today, 'yyyyMMdd');

  const register = await getOpenCashRegister();
  // Simulación: prefijo TT, así se distingue del real y no pisa su numeración.
  const prefix = isTest ? 'TT' : register?.shift ? (register.shift === 'MANANA' ? 'TM' : 'TN') : '';
  const pad = prefix ? 3 : 4;
  const startsWith = `${dateStr}-${prefix}`;

  // Último número usado con esta fecha+prefijo. Como el sufijo va con ceros a la
  // izquierda, el orden lexicográfico descendente da el máximo real.
  const last = await prisma.order.findFirst({
    where: prefix
      ? { orderNumber: { startsWith } }
      : // formato por día: excluir los de turno (que tienen "-T…").
        { orderNumber: { startsWith: `${dateStr}-` }, NOT: { orderNumber: { startsWith: `${dateStr}-T` } } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  const lastNum = last ? parseInt(last.orderNumber.slice(-pad), 10) || 0 : 0;
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

export async function createOrder(
  userId: string,
  data: CreateOrderInput,
  // Pedidos tomados desde el mostrador/admin: se confirman al instante y se
  // imprimen (cocina + comanda) apenas se cargan.
  options?: { printOnCreate?: boolean; confirmImmediately?: boolean; isTest?: boolean }
) {
  // Pedido de simulación (caja test): no controla ni descuenta stock real.
  const isTest = !!options?.isTest;

  // No permitir vender postres sin stock suficiente (las demás categorías no controlan stock).
  if (!isTest) await assertPostresStock(data.items);

  // Para delivery sin addressId, creamos la dirección a partir de los datos inline.
  let addressId = data.addressId;
  if (!addressId && data.deliveryType === 'DELIVERY' && data.address) {
    const created = await prisma.address.create({
      data: {
        userId,
        street: data.address.street,
        number: data.address.number,
        apartment: data.address.apartment ?? null,
        city: data.address.city,
        state: data.address.state ?? '',
        reference: data.address.reference ?? null,
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

  const orderData = (orderNumber: string) => ({
    orderNumber,
    userId,
    addressId,
    isTest,
    status: initialStatus,
    deliveryType: data.deliveryType,
    paymentMethod: data.paymentMethod,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    discount: data.discount ?? 0,
    total: data.total,
    cashAmount: data.paymentMethod === 'MIXTO' ? data.cashAmount : null,
    transferAmount: data.paymentMethod === 'MIXTO' ? data.transferAmount : null,
    notes: data.notes,
    phone: data.phone,
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
        status: (data.paid ? 'APPROVED' : 'PENDING') as 'APPROVED' | 'PENDING',
        amount: data.total,
        paidAt: data.paid ? new Date() : null,
      },
    },
  });

  // El número de pedido se calcula por fuera de una transacción, así que dos
  // altas casi simultáneas (doble click, dos cargas a la vez) podrían generar el
  // mismo número. Si el insert choca con la restricción única, regeneramos el
  // número y reintentamos, en vez de fallar con "Unique constraint failed".
  const createWithRetry = async () => {
    for (let attempt = 1; ; attempt++) {
      const orderNumber = await generateOrderNumber(isTest);
      try {
        return await prisma.order.create({ data: orderData(orderNumber), include: ORDER_INCLUDE });
      } catch (e) {
        if (isDuplicateOrderNumber(e) && attempt < 8) continue;
        throw e;
      }
    }
  };
  const order = await createWithRetry();

  // Si está esperando pago (MercadoPago), no avisamos a la cocina todavía ni
  // descontamos stock: ambas cosas se disparan al acreditarse el pago
  // (ver promoteOrderAfterPayment).
  if (initialStatus !== 'PENDIENTE_PAGO') {
    // La simulación no toca el stock real.
    if (!isTest) await adjustPostresStockForOrder(order.id, 'sell');
    notifyOrderReceived(order);
    // Pedidos de mostrador: imprimir cocina + comanda al crearlos.
    if (options?.printOnCreate) {
      emitPrintOrder(order.id);
    }
  }

  return order;
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

  // Recién ahora (pago acreditado) descontamos el stock de postres.
  await adjustPostresStockForOrder(orderId, 'sell');
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
    },
    include: ORDER_INCLUDE,
  });

  // Al cancelar un pedido que ya había descontado stock (todo menos los que
  // seguían en PENDIENTE_PAGO, que nunca descontaron), devolvemos los postres.
  if (
    data.status === 'CANCELADO' &&
    existing.status !== 'CANCELADO' &&
    existing.status !== 'PENDIENTE_PAGO'
  ) {
    await adjustPostresStockForOrder(orderId, 'restore');
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

  emitOrderStatusChanged(orderId, data.status, order);
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
export async function cancelPendingPaymentOrder(orderId: string, userId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error('Pedido no encontrado');
  if (existing.userId !== userId) throw new Error('No autorizado');
  if (existing.status !== 'PENDIENTE_PAGO') {
    throw new Error('Este pedido ya no se puede cancelar');
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
