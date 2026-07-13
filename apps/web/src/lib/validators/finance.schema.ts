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
    // Puede ser 0 solo en Sueldos cuando todo queda "a favor" (ver superRefine).
    amount: z.coerce.number().min(0, 'El monto no puede ser negativo'),
    // Solo para MIXTO: porción en efectivo (el resto se toma como virtual).
    cashAmount: z.coerce.number().min(0).optional().nullable(),
    category: z.string().min(1, 'Seleccioná una categoría'),
    description: z.string().max(500).optional().nullable(),
    paymentMethod: z.enum(FINANCE_PAYMENT_METHODS),
    employeeId: z.string().cuid().optional().nullable(),
    // Solo para Sueldos: cuánto acumula a favor el empleado (además de lo que retira).
    accumulate: z.coerce.number().min(0).optional().nullable(),
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
    // El monto solo puede ser 0 en Sueldos cuando todo queda "a favor"
    // (acumulado > 0). En cualquier otro caso, el monto debe ser mayor a 0.
    const acumulado = data.accumulate ?? 0;
    const soloAcumulado = data.category === FINANCE_CATEGORY_SUELDOS && acumulado > 0;
    if (data.amount <= 0 && !soloAcumulado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'El monto debe ser mayor a 0',
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
    // MIXTO: el efectivo no puede superar el total.
    if (data.paymentMethod === 'MIXTO') {
      const cash = data.cashAmount ?? 0;
      if (cash <= 0 || cash >= data.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cashAmount'],
          message: 'En mixto, el efectivo debe ser mayor a 0 y menor al total',
        });
      }
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
  // La fecha llega como "YYYY-MM-DD". La interpretamos como medianoche LOCAL
  // (no UTC) para que no retroceda un día al mostrarla en la zona horaria del
  // negocio (Argentina, UTC-3).
  hireDate: z.preprocess((val) => {
    if (typeof val === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return val;
  }, z.date({ required_error: 'Ingresá la fecha de ingreso' })),
  active: z.boolean().default(true),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const employeeMovementSchema = z.object({
  kind: z.enum(['ADELANTO', 'ADELANTO_DESCUENTO', 'ACUMULADO_APORTE', 'ACUMULADO_RETIRO']),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  note: z.string().max(500).optional().nullable(),
});

export type EmployeeMovementInput = z.infer<typeof employeeMovementSchema>;

export const openCashRegisterSchema = z
  .object({
    // En una caja de simulación (isTest) el turno es opcional.
    shift: z.enum(CASH_SHIFTS).optional().nullable(),
    openingBalance: z.coerce.number().min(0, 'El saldo inicial no puede ser negativo'),
    notes: z.string().max(500).optional().nullable(),
    isTest: z.boolean().optional(),
  })
  .refine((d) => d.isTest || !!d.shift, {
    message: 'Seleccioná el turno',
    path: ['shift'],
  });

export const closeCashRegisterSchema = z.object({
  countedCash: z.coerce.number().min(0, 'El efectivo contado no puede ser negativo'),
  notes: z.string().max(500).optional().nullable(),
});

export type FinanceTransactionInput = z.infer<typeof financeTransactionSchema>;
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
