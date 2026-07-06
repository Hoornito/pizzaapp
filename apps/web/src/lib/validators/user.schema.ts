import { z } from 'zod';
import { Role } from '@prisma/client';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  image: z.string().optional(),
});

export const adminUpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  image: z.string().optional(),
});

export const addressSchema = z.object({
  street: z.string().min(2, 'La calle es requerida'),
  number: z.string().min(1, 'El número es requerido'),
  apartment: z.string().optional(),
  city: z.string().min(2, 'La ciudad es requerida'),
  state: z.string().min(2, 'La provincia es requerida'),
  zipCode: z.string().optional(),
  reference: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
