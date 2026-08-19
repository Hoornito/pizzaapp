/**
 * Cruce de una dirección escrita por el cliente contra los barrios cargados en
 * Configuración → Zonas de reparto. Sin prisma: lo usan el servidor (para
 * bloquear por horario) y el checkout (para no geocodificar un barrio, que el
 * mapa nunca encuentra y hacía saltar "fuera de zona").
 */

export interface AreaLike {
  name: string;
  blockedFrom?: string | null;
  blockedTo?: string | null;
  active?: boolean;
}

/** Sin acentos ni mayúsculas: el cliente escribe "Los Álamos" o "los alamos". */
export function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palabras que no distinguen un barrio de otro. Se sacan de los dos lados para
 * que "Barrio Los Álamos" matchee con "los alamos lote 45", que es como lo
 * escribe la gente.
 */
const RELLENO = new Set([
  'barrio', 'bo', 'b', 'country', 'club', 'privado', 'condominio',
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'lote', 'lt', 'casa', 'mz', 'manzana',
]);

export function palabras(v: string): string[] {
  return normalizar(v)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !RELLENO.has(w));
}

/**
 * ¿La dirección nombra a este barrio? Pedimos que todas las palabras propias
 * del barrio estén en la dirección, en cualquier orden: no alcanza con que uno
 * contenga al otro porque suelen agregar el lote.
 */
export function direccionEsDelBarrio(street: string, areaName: string): boolean {
  const delBarrio = palabras(areaName);
  // Un nombre que es puro relleno ("Barrio") no puede identificar nada.
  if (delBarrio.length === 0) return false;
  const enDireccion = new Set(palabras(street));
  return delBarrio.every((w) => enDireccion.has(w));
}

/** El primer barrio activo que nombre la dirección, o null. */
export function buscarBarrio<T extends AreaLike>(street: string, areas: T[]): T | null {
  if (!street.trim()) return null;
  return areas.find((a) => a.active !== false && direccionEsDelBarrio(street, a.name)) ?? null;
}

/** "HH:MM" → minutos desde la medianoche. null si viene roto. */
export function parseHHMM(v: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * ¿A ese barrio no se reparte a esa hora? Sin franja cargada nunca bloquea.
 * Contempla franjas que cruzan la medianoche (23:00–01:00).
 */
export function barrioBloqueadoA(area: AreaLike, when: Date): boolean {
  const desde = parseHHMM(area.blockedFrom);
  const hasta = parseHHMM(area.blockedTo);
  if (desde == null || hasta == null) return false;

  const minutos = when.getHours() * 60 + when.getMinutes();
  return desde <= hasta
    ? minutos >= desde && minutos < hasta
    : minutos >= desde || minutos < hasta;
}
