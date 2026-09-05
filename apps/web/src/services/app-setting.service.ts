import { prisma } from '@/lib/prisma';
import { sanitizePhone } from '@/lib/utils';
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

// ─── Números de prueba del bot de WhatsApp ──────────────────────────────────
// Con una caja de SIMULACIÓN abierta el bot no atiende al público (los pedidos
// del entrenamiento se borran al cerrarla): sólo contesta a estos números, que
// son los del local. Se guardan sin formato (solo dígitos) separados por coma.
export const SETTING_WA_TEST_PHONES = 'wa-test-phones';

export async function getWATestPhones(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_WA_TEST_PHONES } });
  if (!row?.value) return [];
  return row.value.split(',').map((p) => p.trim()).filter(Boolean);
}

/** Guarda la lista (acepta los números escritos como sea: se normalizan acá). */
export async function setWATestPhones(phones: string[]): Promise<string[]> {
  const limpios = Array.from(
    new Set(phones.map((p) => sanitizePhone(p)).filter((p) => p.length >= 6))
  );
  const value = limpios.join(',');
  await prisma.appSetting.upsert({
    where: { key: SETTING_WA_TEST_PHONES },
    update: { value },
    create: { key: SETTING_WA_TEST_PHONES, value },
  });
  return limpios;
}

/**
 * ¿Este número es uno de los de prueba? Compara por los últimos 8 dígitos: el
 * mismo teléfono llega como 5491122334455, 91122334455 o 1122334455 según de
 * dónde venga (webhook de Meta, simulador, cargado a mano).
 */
export async function isWATestPhone(phone: string): Promise<boolean> {
  const cola = (p: string) => sanitizePhone(p).slice(-8);
  const buscado = cola(phone);
  if (buscado.length < 6) return false;
  const lista = await getWATestPhones();
  return lista.some((p) => cola(p) === buscado);
}
