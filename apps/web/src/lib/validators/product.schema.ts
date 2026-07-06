import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  // nullish: el producto puede tener description/image en null (sin cargar).
  description: z.string().nullish(),
  price: z.coerce.number().positive('El precio debe ser positivo'),
  categoryId: z.string().cuid('Categoría inválida'),
  stock: z.coerce.number().int().min(0).default(0),
  available: z.boolean().default(true),
  image: z.string().nullish(),
  // Precios por tamaño (solo pizzas). null/undefined = no se ofrece ese tamaño.
  priceSmall: z.coerce.number().positive().nullish(),
  priceMedium: z.coerce.number().positive().nullish(),
  priceLarge: z.coerce.number().positive().nullish(),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
