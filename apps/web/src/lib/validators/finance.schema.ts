import { z } from 'zod';
import {
  FINANCE_INCOME_CATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  CASH_SHIFTS,
  FINANCE_CATEGORY_SUELDOS,
  FINANCE_CATEGORY_ADELANTOS,
} from '@/lib/constants';

const EMPLOYEE_CATEGORIES: readonly string[] = [
  FINANCE_CATEGORY_SUELDOS,
  FINANCE_CATEGORY_ADELANTOS,
];

export const financeTransactionSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    category: z.string().min(1, 'Seleccioná una categoría'),
    description: z.string().max(500).optional().nullable(),
    paymentMethod: z.enum(FINANCE_PAYMENT_METHODS),
    employeeId: z.string().cuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const allowed: readonly string[] =
      data.type === 'INCOME' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
    if (!allowed.includes(data.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Categoría inválida para este tipo de movimiento',
      });
    }
    // Sueldos y Adelantos requieren empleado asociado
    if (EMPLOYEE_CATEGORIES.includes(data.category) && !data.employeeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['employeeId'],
        message: 'Seleccioná el empleado',
      });
    }
  });

export const employeeSchema = z.object({
  firstName: z.string().min(1, 'Ingresá el nombre'),
  lastName: z.string().min(1, 'Ingresá el apellido'),
  phone: z.string().max(40).optional().nullable(),
  relativePhone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  role: z.enum(['COCINERO', 'REPARTIDOR', 'OTRO']).default('OTRO'),
  dailyWage: z.coerce.number().min(0, 'El sueldo no puede ser negativo'),
  hireDate: z.coerce.date({ required_error: 'Ingresá la fecha de ingreso' }),
  active: z.boolean().default(true),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const employeeMovementSchema = z.object({
  kind: z.enum(['ADELANTO', 'ADELANTO_DESCUENTO', 'ACUMULADO_APORTE', 'ACUMULADO_RETIRO']),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  note: z.string().max(500).optional().nullable(),
});

export type EmployeeMovementInput = z.infer<typeof employeeMovementSchema>;

export const openCashRegisterSchema = z.object({
  shift: z.enum(CASH_SHIFTS, { required_error: 'Seleccioná el turno' }),
  openingBalance: z.coerce.number().min(0, 'El saldo inicial no puede ser negativo'),
  notes: z.string().max(500).optional().nullable(),
});

export const closeCashRegisterSchema = z.object({
  countedCash: z.coerce.number().min(0, 'El efectivo contado no puede ser negativo'),
  notes: z.string().max(500).optional().nullable(),
});

export type FinanceTransactionInput = z.infer<typeof financeTransactionSchema>;
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
