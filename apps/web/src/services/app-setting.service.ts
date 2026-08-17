import { prisma } from '@/lib/prisma';
import { PIZZA_SIZES, type PizzaSize } from '@/types/product.types';

/**
 * Interruptores de disponibilidad del menú. No se llevan por stock en unidades
 * (la pizza se hace al momento): se cortan a mano cuando se acaba la masa de
 * molde o los discos de un tamaño.
 */
export const SETTING_MOLDE_DISABLED = 'molde-disabled';
export const sizeSettingKey = (size: PizzaSize) => `size-${size}-disabled`;

export interface MenuFlags {
  moldeDisabled: boolean;
  /** true = ese tamaño no se puede pedir. */
  sizeDisabled: Record<PizzaSize, boolean>;
}

export async function getMenuFlags(): Promise<MenuFlags> {
  const rows = await prisma.appSetting.findMany();
  const on = new Set(rows.filter((r) => r.value === '1').map((r) => r.key));
  return {
    moldeDisabled: on.has(SETTING_MOLDE_DISABLED),
    sizeDisabled: Object.fromEntries(
      PIZZA_SIZES.map((s) => [s, on.has(sizeSettingKey(s))])
    ) as Record<PizzaSize, boolean>,
  };
}

/** Guarda solo lo que venga definido; el resto queda como estaba. */
export async function saveMenuFlags(input: {
  moldeDisabled?: boolean;
  sizeDisabled?: Partial<Record<PizzaSize, boolean>>;
}): Promise<MenuFlags> {
  const cambios: [string, boolean][] = [];
  if (input.moldeDisabled !== undefined) cambios.push([SETTING_MOLDE_DISABLED, input.moldeDisabled]);
  for (const s of PIZZA_SIZES) {
    const v = input.sizeDisabled?.[s];
    if (v !== undefined) cambios.push([sizeSettingKey(s), v]);
  }

  for (const [key, value] of cambios) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: value ? '1' : '0' },
      create: { key, value: value ? '1' : '0' },
    });
  }
  return getMenuFlags();
}
