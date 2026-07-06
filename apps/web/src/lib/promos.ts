import type { EmpanadaDozen } from '@/types/product.types';

/**
 * Definición de la composición de cada promoción (Promo 1..12). El modelo de
 * datos (Promotion) sólo guarda nombre/precio/descripción; acá vive el detalle
 * con tamaños de pizza y la cantidad de empanadas "a elección", que no se puede
 * representar con PromotionItem. Se usa para:
 *   - armar las notas del ítem (lo que ve la cocina en el ticket), y
 *   - saber cuántas empanadas debe elegir el cliente/cajero.
 */
export interface PromoComponent {
  label: string;
  qty: number;
}

export interface PromoDef {
  fixed: PromoComponent[];
  /** Cantidad de empanadas a elegir (si la promo lo incluye). */
  chooseEmpanadas?: number;
}

export const PROMO_DEFS: Record<string, PromoDef> = {
  'promo-1': { fixed: [{ label: 'Muzzarella (Grande)', qty: 2 }], chooseEmpanadas: 6 },
  'promo-2': { fixed: [{ label: 'Muzzarella (Grande)', qty: 2 }, { label: 'Fainá (porción)', qty: 4 }] },
  'promo-3': { fixed: [{ label: 'Jamón y Morrones (Grande)', qty: 1 }, { label: 'Muzzarella (Grande)', qty: 1 }, { label: 'Fainá (porción)', qty: 4 }] },
  'promo-4': { fixed: [{ label: 'Muzzarella (Grande)', qty: 1 }, { label: 'Napolitana (Grande)', qty: 1 }, { label: 'Fainá (porción)', qty: 4 }] },
  'promo-5': { fixed: [{ label: 'Muzzarella (Grande)', qty: 1 }, { label: 'Fainá (porción)', qty: 2 }], chooseEmpanadas: 6 },
  'promo-6': { fixed: [], chooseEmpanadas: 16 },
  'promo-7': { fixed: [{ label: 'Muzzarella (Grande)', qty: 2 }, { label: 'Fugazza (Grande)', qty: 1 }] },
  'promo-8': { fixed: [{ label: 'Muzzarella (Grande)', qty: 1 }, { label: 'Anchoas (Grande)', qty: 1 }, { label: 'Fugazza (Grande)', qty: 1 }] },
  'promo-9': { fixed: [{ label: 'Muzzarella (Mediana)', qty: 1 }], chooseEmpanadas: 6 },
  'promo-10': { fixed: [{ label: 'Americana (Grande)', qty: 1 }, { label: 'Napolitana (Grande)', qty: 1 }, { label: 'Fainá (porción)', qty: 4 }] },
  'promo-11': { fixed: [{ label: 'Muzzarella (Grande)', qty: 1 }], chooseEmpanadas: 12 },
  'promo-12': { fixed: [{ label: 'Muzzarella (Grande)', qty: 3 }] },
};

/** Cantidad de empanadas a elegir para la promo (0 si no aplica). */
export function promoEmpanadaCount(promoId: string): number {
  return PROMO_DEFS[promoId]?.chooseEmpanadas ?? 0;
}

/**
 * Notas del ítem de promoción para el ticket de cocina: los componentes fijos
 * (con tamaño) y, si corresponde, las empanadas elegidas. `chosen` es la
 * composición devuelta por el modal de selección.
 */
export function formatPromoNotes(promoId: string, chosen?: EmpanadaDozen | null): string {
  const def = PROMO_DEFS[promoId];
  if (!def) return '';
  const lines = def.fixed.map((c) => `${c.qty}× ${c.label}`);
  if (def.chooseEmpanadas) {
    lines.push(`${def.chooseEmpanadas} empanadas a elección:`);
    for (const f of (chosen?.flavors ?? []).filter((f) => f.quantity > 0)) {
      lines.push(`• ${f.quantity} ${f.name.replace(/^Empanada de\s+/i, '').replace(/^Empanada\s+/i, '')}`);
    }
  }
  return lines.join('\n');
}
