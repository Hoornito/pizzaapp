import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { EXTRAS_CATEGORY_SLUG } from '@/lib/constants';
import { type ProductWithCategory } from '@/types/product.types';

const PIZZAS_SLUG = 'pizzas';
// Categorías donde el stock se lleva DE VERDAD por cantidad. En el resto
// (pizzas, empanadas, fainá) se produce al momento y el campo `stock` queda en 0
// sin significar nada: ahí lo que manda es `available`.
const STOCK_TRACKED_SLUGS = new Set(['bebidas', 'postres']);

/** ¿El producto no se puede vender ahora? */
export function isOutOfStock(p: { available: boolean; stock: number; category: { slug: string } }): boolean {
  if (!p.available) return true;
  return STOCK_TRACKED_SLUGS.has(p.category.slug) && p.stock <= 0;
}

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
  /** Nombres de lo que hoy NO se puede vender (para avisarle al cliente). */
  outOfStock: string[];
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
    // Traemos TODO (no sólo lo disponible): lo que no se puede vender se separa
    // aparte, así el bot puede decir "hoy no tenemos" en vez de hacerse el
    // desentendido con un producto que el cliente sabe que existe.
    prisma.product.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.promotion.findMany({
      where: { available: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const sellable = allProducts.filter((p) => !isOutOfStock(p));
  const outOfStock = allProducts
    .filter((p) => isOutOfStock(p) && p.category.slug !== EXTRAS_CATEGORY_SLUG)
    .map((p) => p.name);

  const pizzas = sellable.filter((p) => p.category.slug === PIZZAS_SLUG);
  const extras = sellable.filter((p) => p.category.slug === EXTRAS_CATEGORY_SLUG);
  const products = sellable.filter(
    (p) => p.category.slug !== PIZZAS_SLUG && p.category.slug !== EXTRAS_CATEGORY_SLUG
  );
  const promotions = promos.map((p) => ({
    id: p.id,
    name: p.name,
    price: toNumber(p.promotionalPrice),
    description: p.description,
  }));

  const menuText = buildMenuText(pizzas, products, extras, promotions, outOfStock);

  const data: WAMenu = { menuText, pizzas, products, extras, promotions, outOfStock };
  cache = { at: Date.now(), data };
  return data;
}

/**
 * Menú para el modelo. Lleva PRECIOS porque el cliente pregunta "cuánto sale" y
 * antes el bot no podía contestar hasta cerrar todo el pedido. Son sólo para
 * COTIZAR de palabra: el total del pedido lo sigue calculando el sistema desde
 * la base, nunca el modelo.
 */
function buildMenuText(
  pizzas: ProductWithCategory[],
  products: ProductWithCategory[],
  extras: ProductWithCategory[],
  promotions: WAMenu['promotions'],
  outOfStock: string[]
): string {
  const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
  const parts: string[] = [];

  // Pizzas: solo los gustos (tamaños fijos). Sin precios.
  if (pizzas.length) {
    parts.push('# PIZZAS — gusto (precio Individual / Mediana / Grande; mitad y mitad cobra el promedio)');
    for (const p of pizzas) {
      const precios = (['priceSmall', 'priceMedium', 'priceLarge'] as const)
        .map((f) => (p[f] == null ? '—' : money(toNumber(p[f]))))
        .join(' / ');
      parts.push(`- ${p.name}: ${precios}`);
    }
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
    for (const p of items) parts.push(`- ${p.name}: ${money(toNumber(p.price))}`);
  }

  // Agregados: NO son ítems del menú, son lo que se puede sumar a un ítem. Van
  // aparte para que el modelo use el nombre exacto en el campo "extra" y el
  // sistema le pueda poner precio solo.
  if (extras.length) {
    parts.push('\n# AGREGADOS (no son ítems sueltos: se suman a un ítem con el campo "extra")');
    for (const e of extras) parts.push(`- ${e.name}: ${money(toNumber(e.price))}`);
  }

  if (promotions.length) {
    parts.push('\n# PROMOCIONES');
    for (const promo of promotions) {
      const desc = promo.description ? ` — ${promo.description}` : '';
      parts.push(`- ${promo.name}: ${money(promo.price)}${desc}`);
    }
  }

  // Lo que hoy no se puede vender. Va explicito para que el bot lo diga en vez
  // de ignorarlo: el cliente sabe que el producto existe y pregunta por el.
  if (outOfStock.length) {
    parts.push('\n# SIN STOCK HOY (NO se pueden pedir; si los piden, avisa que hoy no hay)');
    for (const name of outOfStock) parts.push(`- ${name}`);
  }

  return parts.join('\n');
}
