'use client';

import { useEffect, useState } from 'react';
import { PIZZA_SIZES, type PizzaSize } from '@/types/product.types';

export interface MenuFlags {
  moldeDisabled: boolean;
  sizeDisabled: Record<PizzaSize, boolean>;
}

const NINGUNO: MenuFlags = {
  moldeDisabled: false,
  sizeDisabled: Object.fromEntries(PIZZA_SIZES.map((s) => [s, false])) as Record<PizzaSize, boolean>,
};

// Una sola consulta compartida por todos los que la piden en la misma pantalla
// (el menú monta muchas cards). Se cachea la promesa, no el resultado.
let cache: Promise<MenuFlags> | null = null;

function fetchFlags(): Promise<MenuFlags> {
  if (!cache) {
    cache = fetch('/api/settings/menu-flags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => ({ ...NINGUNO, ...(d.data ?? {}) }))
      .catch(() => NINGUNO);
  }
  return cache;
}

/**
 * Qué se puede pedir hoy (pizza al molde, tamaños). Lo apagan desde Productos
 * cuando se quedan sin masa: es un hook y no una prop para que ninguna pantalla
 * se olvide de pasarlo.
 */
export function useMenuFlags(): MenuFlags {
  const [flags, setFlags] = useState<MenuFlags>(NINGUNO);

  useEffect(() => {
    let vivo = true;
    fetchFlags().then((f) => { if (vivo) setFlags(f); });
    return () => { vivo = false; };
  }, []);

  return flags;
}

/** Descarta la caché (después de cambiar un interruptor desde el admin). */
export function invalidateMenuFlags(): void {
  cache = null;
}
