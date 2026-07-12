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
});

export const orderAddressSchema = z.object({
  street: z.string().min(1, 'La calle es requerida'),
  number: z.string().min(1, 'El número es requerido'),
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
    total: z.coerce.number().positive(),
    // Sólo para pago MIXTO: reparto entre efectivo y transferencia.
    cashAmount: z.coerce.number().min(0).optional(),
    transferAmount: z.coerce.number().min(0).optional(),
    // Mostrador: el pedido ya se cobró al cargarlo (marca el pago como aprobado).
    paid: z.boolean().optional(),
    notes: z.string().optional(),
    phone: z.string().optional(),
    whatsappToken: z.string().optional(),
    items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un ítem'),
  })
  .refine((d) => d.deliveryType === 'PICKUP' || !!d.addressId || !!d.address, {
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
