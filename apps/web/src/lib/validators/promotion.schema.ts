import { z } from 'zod';

export const promotionItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1),
});

export const promotionSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().optional(),
  promotionalPrice: z.coerce.number().positive('El precio debe ser positivo'),
  available: z.boolean().default(true),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  image: z.string().optional(),
  items: z.array(promotionItemSchema).min(1, 'Debe incluir al menos un producto'),
});

export type PromotionInput = z.infer<typeof promotionSchema>;
