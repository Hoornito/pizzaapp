import { z } from 'zod';

export const promotionItemSchema = z.object({
  // No exigimos cuid: los productos del menú real vienen del seed con ids
  // legibles ("prod-muzza"), así que el formato no dice nada de su validez.
  productId: z.string().min(1),
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
  // Una promo puede no listar productos (p. ej. las que se arman a mano en el
  // mostrador): lo único obligatorio es nombre y precio.
  items: z.array(promotionItemSchema).default([]),
});

export type PromotionInput = z.infer<typeof promotionSchema>;
