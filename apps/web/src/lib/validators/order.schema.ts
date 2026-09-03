import { z } from 'zod';
import { DeliveryType, PaymentMethod } from '@prisma/client';

export const orderItemSchema = z.object({
  // nullish: aceptan string | null | undefined (los ítems de promoción mandan
  // productId: null, y los de producto promotionId: null).
  productId: z.string().nullish(),
  promotionId: z.string().nullish(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().positive(),
  notes: z.string().nullish(),
  // Solo en promos con productos "a elección" (p. ej. las empanadas): qué eligió
  // el cliente. No afecta el precio —lo fija la promo—, se guarda para saber qué
  // salió de verdad en los reportes.
  promoChoices: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .optional(),
});

export const orderAddressSchema = z.object({
  street: z.string().min(1, 'La calle es requerida'),
  // Opcional a propósito: en los countries y barrios cerrados de la zona el
  // cliente no siempre sabe el lote, y la calle es una ruta sin altura. Quien
  // valida que se pueda ubicar es `esDireccionUbicable` (delivery-area.service),
  // que exige número SALVO que la dirección nombre un barrio cargado.
  number: z.string().nullish(),
  apartment: z.string().nullish(),
  city: z.string().min(1, 'La ciudad es requerida'),
  state: z.string().nullish(),
  reference: z.string().nullish(),
});

export const createOrderSchema = z
  .object({
    addressId: z.string().cuid().optional(),
    // Dirección inline: si no hay addressId, se crea a partir de estos datos.
    address: orderAddressSchema.optional(),
    deliveryType: z.nativeEnum(DeliveryType),
    paymentMethod: z.nativeEnum(PaymentMethod),
    subtotal: z.coerce.number().positive(),
    deliveryFee: z.coerce.number().min(0),
    // Descuento aplicado (mostrador). Opcional; 0 por defecto.
    discount: z.coerce.number().min(0).optional(),
    // Propina para el repartidor (cliente delivery). Opcional; 0 por defecto.
    tip: z.coerce.number().min(0).optional(),
    // Puede ser 0 si el descuento cubre el total (pedido bonificado al 100%).
    total: z.coerce.number().min(0),
    // Sólo para pago MIXTO: reparto entre efectivo y transferencia.
    cashAmount: z.coerce.number().min(0).optional(),
    transferAmount: z.coerce.number().min(0).optional(),
    // Sólo EFECTIVO: con cuánto paga el cliente (para el vuelto). Opcional.
    cashReceived: z.coerce.number().min(0).optional(),
    // Mostrador: el pedido ya se cobró al cargarlo (marca el pago como aprobado).
    paid: z.boolean().optional(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    // Pedidos Ya: repartidor de la plataforma que pasa a buscarlo.
    courierName: z.string().optional(),
    // Pedidos Ya: plus que carga el mostrador. Opcional; sin cargar no se
    // guarda ni se imprime nada.
    pedidosYaExtra: z.coerce.number().min(0).optional(),
    // El cliente pidió guardar la dirección para sus próximos pedidos.
    saveAddress: z.boolean().optional(),
    whatsappToken: z.string().optional(),
    // De dónde salió el pedido (web / mostrador / bot de WhatsApp).
    source: z.enum(['WEB', 'MOSTRADOR', 'WHATSAPP']).optional(),
    // Pedido programado: ISO del inicio de la franja elegida. Ausente = "lo
    // antes posible". La validación de que la franja siga siendo válida se hace
    // en el servidor al crear el pedido (schedule.service).
    scheduledFor: z.string().datetime().optional(),
    // Minutos que carga el local al tomar el pedido (mostrador). En los pedidos
    // programados no aplica: manda el horario elegido.
    estimatedTime: z.coerce.number().int().min(0).optional(),
    items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un ítem'),
  })
  // Solo el delivery propio necesita dirección (retiro y Pedidos Ya no).
  .refine((d) => d.deliveryType !== 'DELIVERY' || !!d.addressId || !!d.address, {
    message: 'La dirección es requerida para delivery',
    path: ['addressId'],
  })
  .refine(
    (d) =>
      d.paymentMethod !== 'MIXTO' ||
      (d.cashAmount !== undefined && d.transferAmount !== undefined),
    {
      message: 'Indicá el monto en efectivo y en transferencia',
      path: ['cashAmount'],
    }
  )
  .refine(
    (d) =>
      d.paymentMethod !== 'MIXTO' ||
      // la suma debe coincidir con el total (tolerancia por redondeo)
      Math.abs((d.cashAmount ?? 0) + (d.transferAmount ?? 0) - d.total) < 0.01,
    {
      message: 'El efectivo y la transferencia deben sumar el total',
      path: ['cashAmount'],
    }
  );

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDIENTE_PAGO',
    'RECIBIDO',
    'CONFIRMADO',
    'PREPARANDO',
    'EN_HORNO',
    'LISTO',
    'EN_REPARTO',
    'ENTREGADO',
    'CANCELADO',
  ]),
  estimatedTime: z.coerce.number().int().min(0).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
