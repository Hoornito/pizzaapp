import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';

/** El descuento de la app es una sola fila con id fijo. */
export const APP_DISCOUNT_ID = 'app-discount';

export interface AppDiscountView {
  percentage: number;
  label: string;
  active: boolean;
}

const EMPTY: AppDiscountView = { percentage: 0, label: '', active: false };

/** Lo que ve el admin: existe o no, siempre devuelve algo editable. */
export async function getAppDiscount(): Promise<AppDiscountView> {
  const row = await prisma.appDiscount.findUnique({ where: { id: APP_DISCOUNT_ID } });
  if (!row) return EMPTY;
  return { percentage: toNumber(row.percentage), label: row.label, active: row.active };
}

/**
 * El descuento vigente, o null. Un porcentaje en 0 no es un descuento aunque
 * esté "activo": así el banner no anuncia un 0%.
 */
export async function getActiveAppDiscount(): Promise<AppDiscountView | null> {
  const d = await getAppDiscount();
  return d.active && d.percentage > 0 ? d : null;
}

export async function saveAppDiscount(data: AppDiscountView): Promise<AppDiscountView> {
  const row = await prisma.appDiscount.upsert({
    where: { id: APP_DISCOUNT_ID },
    update: { percentage: data.percentage, label: data.label, active: data.active },
    create: { id: APP_DISCOUNT_ID, ...data },
  });
  return { percentage: toNumber(row.percentage), label: row.label, active: row.active };
}

/**
 * Monto del descuento sobre el subtotal de productos. La propina no entra: es
 * plata para el repartidor, no una venta.
 */
export function discountAmount(subtotal: number, percentage: number): number {
  return Math.round(subtotal * (percentage / 100) * 100) / 100;
}
