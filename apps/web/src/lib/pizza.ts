import { toNumber } from '@/lib/utils';
import {
  PIZZA_SIZE_PRICE_FIELD,
  PIZZA_SIZE_LABELS,
  type PizzaSize,
  type PizzaSelection,
  type ProductWithCategory,
} from '@/types/product.types';

/** Precio de un gusto en un tamaño dado, o null si no se ofrece en ese tamaño. */
export function flavorPrice(product: ProductWithCategory, size: PizzaSize): number | null {
  const value = product[PIZZA_SIZE_PRICE_FIELD[size]];
  return value == null ? null : toNumber(value);
}

/** Gustos disponibles para un tamaño (los que tienen precio cargado). */
export function flavorsForSize(pizzas: ProductWithCategory[], size: PizzaSize): ProductWithCategory[] {
  return pizzas.filter((p) => flavorPrice(p, size) != null);
}

/** Rango de precios (mín–máx) de un tamaño, o null si no hay gustos. */
export function sizeRange(pizzas: ProductWithCategory[], size: PizzaSize): { min: number; max: number } | null {
  const prices = pizzas
    .map((p) => flavorPrice(p, size))
    .filter((n): n is number => n != null);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Precio de una pizza: entera = el precio del gusto; mitad y mitad = el promedio
 * (50% de cada mitad).
 */
export function pizzaPrice(flavorPrices: number[]): number {
  if (flavorPrices.length === 0) return 0;
  const sum = flavorPrices.reduce((a, b) => a + b, 0);
  return Math.round((sum / flavorPrices.length) * 100) / 100;
}

/** Nombre legible de la pizza armada. */
export function formatPizzaName(sel: PizzaSelection): string {
  const label = PIZZA_SIZE_LABELS[sel.size];
  if (sel.flavors.length === 1) return `${label} — ${sel.flavors[0].name}`;
  return `${label} — ${sel.flavors.map((f) => `½ ${f.name}`).join(' · ')}`;
}

/**
 * Texto de composición para el ticket/pedido. Incluye el tamaño para que quede
 * registrado en el pedido (el ítem sólo persiste productId + estas notas). Ej:
 *   "Pizza Mediana · Muzzarella"
 *   "Pizza Grande · ½ Especial de la casa · ½ Muzzarella"
 */
export function formatPizzaNotes(sel: PizzaSelection): string {
  const size = PIZZA_SIZE_LABELS[sel.size];
  const flavors =
    sel.flavors.length === 1
      ? sel.flavors[0].name
      : sel.flavors.map((f) => `½ ${f.name}`).join(' · ');
  return `${size} · ${flavors}`;
}

// Incluye "Pizza Chica" (etiqueta vieja) para que los pedidos anteriores al
// renombre a "Pizza Individual" sigan reconociéndose como pizza en los tickets.
const SIZE_LABELS = [...Object.values(PIZZA_SIZE_LABELS), 'Pizza Chica'];

/**
 * Si las notas de un ítem describen una pizza (empiezan con un tamaño), las
 * notas ya son el título legible completo (tamaño + gustos). Devuelve true para
 * que las vistas muestren las notas como nombre del ítem.
 */
export function isPizzaItemNotes(notes?: string | null): boolean {
  return !!notes && SIZE_LABELS.some((label) => notes.startsWith(label));
}
