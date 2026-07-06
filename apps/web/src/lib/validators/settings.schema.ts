import { z } from 'zod';

export const businessHoursSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
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

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
export type ShipmentZoneInput = z.infer<typeof shipmentZoneSchema>;
export type DeliveryFeeInput = z.infer<typeof deliveryFeeSchema>;
