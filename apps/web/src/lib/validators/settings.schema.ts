import { z } from 'zod';

export const businessHoursSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  // 0 = mediodía, 1 = noche. Por compatibilidad con lo que había, si no viene
  // se asume el turno 0.
  shift: z.coerce.number().int().min(0).max(1).default(0),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  isOpen: z.boolean(),
});

export const shipmentZoneSchema = z.object({
  name: z.string().min(2),
  radiusKm: z.coerce.number().positive(),
  available: z.boolean().default(true),
});

export const deliveryFeeSchema = z.object({
  shipmentZoneId: z.string().cuid().optional(),
  name: z.string().min(2),
  fee: z.coerce.number().min(0),
  minOrderAmount: z.coerce.number().min(0).optional(),
  isDefault: z.boolean().default(false),
});

/** Descuento general de la app (solo para pedidos de clientes por la web). */
export const appDiscountSchema = z.object({
  percentage: z.coerce.number().min(0, 'No puede ser negativo').max(100, 'No puede pasar de 100%'),
  label: z.string().max(60, 'Máximo 60 caracteres'),
  active: z.boolean(),
});

export type AppDiscountInput = z.infer<typeof appDiscountSchema>;
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
export type ShipmentZoneInput = z.infer<typeof shipmentZoneSchema>;
export type DeliveryFeeInput = z.infer<typeof deliveryFeeSchema>;
