import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { EXTRAS_CATEGORY_SLUG } from '@/lib/constants';
import { type ProductWithCategory } from '@/types/product.types';

const PIZZAS_SLUG = 'pizzas';

export interface WAMenu {
  /** Texto compacto del menú para pasarle al modelo. */
  menuText: string;
  /** Sabores de pizza (Product con precios por tamaño), para resolver precios. */
  pizzas: ProductWithCategory[];
  /** Productos sueltos no-pizza (empanadas, bebidas, fainá, postres…). */
  products: ProductWithCategory[];
  /**
   * Agregados que se cobran (categoría interna "extras"): no son ítems sueltos
   * del menú, son el precio del extra de otro ítem ("+ huevo", "doble muzzarella").
   */
  extras: ProductWithCategory[];
  /** Promociones activas. */
  promotions: { id: string; name: string; price: number; description: string | null }[];
}

// Caché en memoria: el menú cambia poco y lo consultamos por cada mensaje. Un TTL
// corto evita reconstruirlo (y re-pegar precios) en cada llamada del bot.
let cache: { at: number; data: WAMenu } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** Quita acentos y pasa a minúsculas, para comparar nombres de forma tolerante. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita marcas diacríticas combinantes
    .toLowerCase()
    .trim();
}

export async function getWAMenu(force = false): Promise<WAMenu> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const [allProducts, promos] = await Promise.all([
    prisma.product.findMany({
      where: { available: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.promotion.findMany({
      where: { available: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pizzas = allProducts.filter((p) => p.category.slug === PIZZAS_SLUG);
  const extras = allProducts.filter((p) => p.category.slug === EXTRAS_CATEGORY_SLUG);
  const products = allProducts.filter(
    (p) => p.category.slug !== PIZZAS_SLUG && p.category.slug !== EXTRAS_CATEGORY_SLUG
  );
  const promotions = promos.map((p) => ({
    id: p.id,
    name: p.name,
    price: toNumber(p.promotionalPrice),
    description: p.description,
  }));

  const menuText = buildMenuText(pizzas, products, extras, promotions);

  const data: WAMenu = { menuText, pizzas, products, extras, promotions };
  cache = { at: Date.now(), data };
  return data;
}

// El modelo NO necesita precios (los calcula el sistema desde la DB): le mandamos
// solo los NOMBRES para que identifique cada ítem. Esto baja mucho los tokens.
function buildMenuText(
  pizzas: ProductWithCategory[],
  products: ProductWithCategory[],
  extras: ProductWithCategory[],
  promotions: WAMenu['promotions']
): string {
  const parts: string[] = [];

  // Pizzas: solo los gustos (tamaños fijos). Sin precios.
  if (pizzas.length) {
    parts.push('# PIZZAS — gustos (tamaños: Individual, Mediana, Grande; se puede mitad y mitad)');
    for (const p of pizzas) parts.push(`- ${p.name}`);
  }

  // Resto de productos, agrupados por categoría. Solo nombres.
  const byCat = new Map<string, ProductWithCategory[]>();
  for (const p of products) {
    const arr = byCat.get(p.category.name) ?? [];
    arr.push(p);
    byCat.set(p.category.name, arr);
  }
  for (const [catName, items] of byCat) {
    parts.push(`\n# ${catName.toUpperCase()}`);
    for (const p of items) parts.push(`- ${p.name}`);
  }

  // Agregados: NO son ítems del menú, son lo que se puede sumar a un ítem. Van
  // aparte para que el modelo use el nombre exacto en el campo "extra" y el
  // sistema le pueda poner precio solo.
  if (extras.length) {
    parts.push('\n# AGREGADOS (no son ítems sueltos: se suman a un ítem con el campo "extra")');
    for (const e of extras) parts.push(`- ${e.name}`);
  }

  if (promotions.length) {
    parts.push('\n# PROMOCIONES');
    for (const promo of promotions) {
      const desc = promo.description ? ` — ${promo.description}` : '';
      parts.push(`- ${promo.name}${desc}`);
    }
  }

  return parts.join('\n');
}
