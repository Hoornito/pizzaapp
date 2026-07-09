import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CURRENCY_SYMBOL } from './constants';
import type { EmpanadaDozen } from '@/types/product.types';

/**
 * Convierte la composición de docenas de empanadas en un texto legible para el
 * negocio (ticket de cocina / WhatsApp), con cada sabor en su propia línea para
 * facilitar la preparación. Ej:
 *   Docena 1:
 *   • 6 Carne
 *   • 6 Pollo
 *   Docena 2:
 *   • 12 Jamón y Queso
 * Con una sola docena se omite el encabezado "Docena 1:".
 */
export function formatDozensNotes(dozens: EmpanadaDozen[]): string {
  const multiple = dozens.length > 1;
  return dozens
    .map((dozen, i) => {
      const lines = dozen.flavors
        .filter((f) => f.quantity > 0)
        .map((f) => `• ${f.quantity} ${f.name.replace(/^Empanada de\s+/i, '')}`);
      return multiple ? `Docena ${i + 1}:\n${lines.join('\n')}` : lines.join('\n');
    })
    .join('\n');
}

/**
 * Los pedidos cargados desde el Mostrador quedan a nombre del admin, pero el
 * nombre del cliente real se guarda en `notes` como "Cliente: X · <obs>". Esto
 * separa ese nombre de las observaciones para mostrarlo bien en los tickets.
 * Si no hay "Cliente:" en las notas (pedido de un cliente logueado), usa el
 * `fallback` (el nombre del usuario) y deja las notas tal cual.
 */
export function parseOrderCustomer(
  notes: string | null | undefined,
  fallback?: string | null
): { customerName: string; cleanNotes: string } {
  const parts = (notes ?? '').split(' · ');
  const idx = parts.findIndex((p) => /^cliente:\s*/i.test(p));
  if (idx >= 0) {
    const name = parts[idx].replace(/^cliente:\s*/i, '').trim();
    const rest = parts.filter((_, i) => i !== idx).join(' · ');
    return { customerName: name || (fallback ?? ''), cleanNotes: rest };
  }
  return { customerName: fallback ?? '', cleanNotes: notes ?? '' };
}

export interface TicketItemInput {
  quantity: number;
  notes?: string | null;
  unitPrice?: unknown;
  productId?: string | null;
  promotionId?: string | null;
  product?: { name: string | null } | null;
  promotion?: { name: string | null } | null;
}

export interface TicketGroup {
  quantity: number;
  isDozen: boolean;
  isPizza: boolean;
  /** Texto principal a mostrar. Para pizzas es la nota (tamaño + gustos). */
  title: string;
  notes: string;
  /** Extra de la línea (solo pizzas/promos), ya en mayúsculas. Ej: "EXTRA: HUEVO". */
  extra: string;
  unitPrice: number;
}

/** Separa las líneas "EXTRA: ..." del resto de las notas. */
function splitExtra(rawNotes: string): { base: string; extra: string } {
  const lines = rawNotes.split('\n');
  const extraLines = lines.filter((l) => /^\s*EXTRA:/i.test(l));
  const baseLines = lines.filter((l) => !/^\s*EXTRA:/i.test(l));
  return { base: baseLines.join('\n').trim(), extra: extraLines.map((l) => l.trim()).join(' ') };
}

/**
 * Agrupa los ítems de un pedido para los tickets: junta los idénticos y suma la
 * cantidad. Así 2 pizzas iguales salen como "2x ...". La clave incluye las notas
 * y el extra, así que una pizza con extra y otra sin extra NO se mezclan.
 * `isPizzaNotes` se recibe por parámetro para no acoplar utils con lib/pizza.
 */
export function groupTicketItems(
  items: TicketItemInput[],
  isPizzaNotes: (n: string | null | undefined) => boolean
): TicketGroup[] {
  const map = new Map<string, TicketGroup>();
  for (const it of items) {
    const isDozen = /docena/i.test(it.promotion?.name || '');
    const { base, extra } = splitExtra(it.notes ?? '');
    const isPizza = isPizzaNotes(base);
    const title = isPizza ? base : it.product?.name || it.promotion?.name || '';
    const key = `${isDozen ? 'D' : isPizza ? 'P' : 'O'}|${it.productId ?? ''}|${it.promotionId ?? ''}|${title}|${base}|${extra}`;
    const g = map.get(key);
    if (g) g.quantity += it.quantity;
    else map.set(key, { quantity: it.quantity, isDozen, isPizza, title, notes: base, extra, unitPrice: toNumber(it.unitPrice) });
  }
  return [...map.values()];
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return `${CURRENCY_SYMBOL} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatDateShort(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: es });
}

export function formatTimeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = format(now, 'yyyyMMdd');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${dateStr}-${rand}`;
}

/** Dirección mínima para armar una URL de mapa. */
type MappableAddress = {
  street: string;
  number: string;
  apartment?: string | null;
  city: string;
  state?: string | null;
};

/** Texto de la dirección en una línea (para mostrar o geocodificar). */
export function formatAddressLine(a: MappableAddress): string {
  return [
    [a.street, a.number].filter(Boolean).join(' '),
    a.apartment ? `Dto ${a.apartment}` : '',
    a.city,
    a.state,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * URL de Waze con indicaciones hacia la dirección. Al abrirla, Waze busca el
 * destino y traza la ruta desde la ubicación actual del repartidor.
 */
export function buildWazeUrl(a: MappableAddress): string {
  return `https://waze.com/ul?q=${encodeURIComponent(formatAddressLine(a))}&navigate=yes`;
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce(
    (acc, key) => {
      if (key in obj) acc[key] = obj[key];
      return acc;
    },
    {} as Pick<T, K>
  );
}

/** Forma mínima de un pedido para resolver su método/porciones de pago. */
type PayableOrder = {
  paymentMethod: string;
  total?: unknown;
  cashAmount?: unknown;
  transferAmount?: unknown;
};

/**
 * Texto legible del método de pago de un pedido. Para MIXTO detalla el reparto
 * entre efectivo y transferencia.
 */
export function formatOrderPayment(order: PayableOrder, opts?: { emoji?: boolean }): string {
  const emoji = opts?.emoji ?? true;
  if (order.paymentMethod === 'MIXTO') {
    const cash = formatCurrency(toNumber(order.cashAmount));
    const transfer = formatCurrency(toNumber(order.transferAmount));
    return `${emoji ? '🔀 ' : ''}Mixto (Efectivo ${cash} + Transferencia ${transfer})`;
  }
  if (order.paymentMethod === 'MERCADO_PAGO') return `${emoji ? '💳 ' : ''}Mercado Pago`;
  if (order.paymentMethod === 'TRANSFERENCIA') return `${emoji ? '🏦 ' : ''}Transferencia`;
  return `${emoji ? '💵 ' : ''}Efectivo`;
}

/** Porción del total de un pedido que ingresa en efectivo a la caja. */
export function orderCashPortion(order: PayableOrder): number {
  if (order.paymentMethod === 'EFECTIVO') return toNumber(order.total);
  if (order.paymentMethod === 'MIXTO') return toNumber(order.cashAmount);
  return 0;
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}
