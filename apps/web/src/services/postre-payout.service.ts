import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/utils';
import { norm } from '@/services/wa-menu.service';

/**
 * Cuánto se le paga a la persona de postres, y cuánto le queda al negocio.
 *
 * Hasta ahora el "dinero a favor" se calculaba con el PRECIO DE VENTA del postre
 * ($6.000), no con lo que efectivamente se le paga ($5.000). Este módulo separa
 * las tres cifras que en realidad son distintas:
 *
 *   1. lo que pagó el cliente   (precio de lista − la parte del descuento)
 *   2. lo que se le debe pagar  (tarifa por tamaño, la vigente ese día)
 *   3. lo que queda al negocio  (1 − 2, puede ser negativo)
 *
 * El punto 3 puede dar negativo y está bien: si un postre de $5.000 se vende con
 * 10% de descuento se cobran $4.500 y se pagan $5.000, o sea que el negocio pone
 * $500 de su bolsillo en esa venta.
 */

export type PostreSize = 'GRANDE' | 'CHICO';

/**
 * Lo que se venía pagando ANTES de que existiera la configuración. Es la tarifa
 * que se aplica a toda venta anterior a la primera tarifa guardada, así que el
 * histórico queda bien sin necesidad de backfillear nada.
 *
 * Tocar estos números SÍ recalcula el pasado: son la tarifa "de siempre". Para
 * cambiar el pago de acá en adelante se guarda una tarifa nueva desde el panel.
 */
export const DEFAULT_POSTRE_PAYOUT: Record<PostreSize, number> = {
  GRANDE: 5000,
  CHICO: 2500,
};

/**
 * Tamaño de un postre a partir de su nombre, que es como los distingue el local:
 * el chico lo dice ("Oreo chico"), el grande va con el nombre pelado ("Oreo").
 */
export function postreSize(productName: string): PostreSize {
  return /\bchic[oa]s?\b/.test(norm(productName)) ? 'CHICO' : 'GRANDE';
}

interface RateRow {
  size: string;
  amount: number;
  effectiveFrom: number;
}

/**
 * Tabla de tarifas para resolver cualquier venta por fecha. Se lee una sola vez
 * por cálculo y se consulta en memoria: son pocas filas y se usan una vez por
 * ítem vendido.
 */
export class PostrePayoutRates {
  private constructor(private readonly rows: RateRow[]) {}

  static async load(): Promise<PostrePayoutRates> {
    let rows: { size: string; amount: unknown; effectiveFrom: Date }[] = [];
    try {
      rows = await prisma.postrePayoutRate.findMany({
        orderBy: { effectiveFrom: 'asc' },
        select: { size: true, amount: true, effectiveFrom: true },
      });
    } catch (e) {
      // La tabla puede no existir todavía: en producción la imagen se construye
      // con el código nuevo y la migración corre unos segundos después. Sin
      // tarifas guardadas el resultado es el mismo (se usan los valores de
      // siempre), así que preferimos que el panel funcione antes que reventar.
      console.warn(
        '[postre-payout] no se pudieron leer las tarifas, se usan los valores por defecto:',
        e instanceof Error ? e.message : e
      );
    }
    return new PostrePayoutRates(
      rows.map((r) => ({
        size: r.size,
        amount: toNumber(r.amount),
        effectiveFrom: r.effectiveFrom.getTime(),
      }))
    );
  }

  /**
   * Tarifa vigente para ese tamaño en esa fecha: la última que empezó a regir
   * ANTES de la venta. Si no hay ninguna, la de siempre.
   */
  at(size: PostreSize, when: Date): number {
    const t = when.getTime();
    let valor = DEFAULT_POSTRE_PAYOUT[size];
    for (const r of this.rows) {
      if (r.size !== size) continue;
      if (r.effectiveFrom > t) break; // vienen ordenadas: de acá en más son futuras
      valor = r.amount;
    }
    return valor;
  }

  /** Tarifa que rige HOY (la que se muestra y se edita en el panel). */
  current(size: PostreSize): number {
    return this.at(size, new Date());
  }
}

/** Una venta de postres ya resuelta: qué se cobró y qué se paga. */
export interface PostreSaleLine {
  paidAt: Date;
  productId: string;
  productName: string;
  size: PostreSize;
  quantity: number;
  /** Precio de lista × cantidad, sin descuento. */
  gross: number;
  /** Parte del descuento del pedido que le toca a este ítem. */
  discount: number;
  /** Lo que efectivamente pagó el cliente por este ítem (gross − discount). */
  net: number;
  /** Tarifa por unidad vigente el día de la venta. */
  payoutUnit: number;
  /** Lo que se le debe pagar por este ítem (payoutUnit × cantidad). */
  payout: number;
}

/**
 * Todas las ventas de postres cobradas, con el descuento ya prorrateado.
 *
 * El descuento vive en el PEDIDO (`Order.discount`), no en el ítem: el 10% de la
 * web se calcula sobre el subtotal completo. Para saber cuánto se cobró de más o
 * de menos por los postres hay que repartirlo en proporción a lo que pesan
 * dentro del pedido; si no, un postre con descuento figura cobrado a precio de
 * lista y el resultado del negocio sale inflado.
 */
export async function loadPostreSales(
  categoryId: string,
  range?: { from: Date; to: Date }
): Promise<PostreSaleLine[]> {
  const rates = await PostrePayoutRates.load();

  const orders = await prisma.order.findMany({
    where: {
      status: { not: 'CANCELADO' },
      isTest: false,
      payment: { status: 'APPROVED', ...(range ? { paidAt: { gte: range.from, lte: range.to } } : {}) },
      items: { some: { product: { categoryId } } },
    },
    select: {
      createdAt: true,
      subtotal: true,
      discount: true,
      payment: { select: { paidAt: true } },
      items: {
        where: { product: { categoryId } },
        select: {
          quantity: true,
          subtotal: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  const lines: PostreSaleLine[] = [];
  for (const o of orders) {
    const paidAt = o.payment?.paidAt ?? o.createdAt;
    const orderSubtotal = toNumber(o.subtotal);
    const orderDiscount = toNumber(o.discount);
    // Sin subtotal no hay proporción posible (no debería pasar); sin descuento
    // no hay nada que repartir. En los dos casos el neto es el bruto.
    const ratio = orderSubtotal > 0 && orderDiscount > 0 ? orderDiscount / orderSubtotal : 0;

    for (const it of o.items) {
      if (!it.product) continue;
      const gross = toNumber(it.subtotal);
      const discount = round2(gross * ratio);
      const size = postreSize(it.product.name);
      const payoutUnit = rates.at(size, paidAt);
      lines.push({
        paidAt,
        productId: it.product.id,
        productName: it.product.name,
        size,
        quantity: it.quantity,
        gross,
        discount,
        net: round2(gross - discount),
        payoutUnit,
        payout: round2(payoutUnit * it.quantity),
      });
    }
  }
  return lines;
}

/** Totales de un conjunto de ventas de postres. */
export interface PostreTotals {
  unidadesGrandes: number;
  unidadesChicas: number;
  unidades: number;
  /** Total a precio de lista. */
  bruto: number;
  /** Descuentos que absorbieron los postres. */
  descuentos: number;
  /** Lo que pagaron los clientes (bruto − descuentos). */
  cobrado: number;
  pagoGrandes: number;
  pagoChicos: number;
  /** Total a pagarle a la persona de postres. */
  pago: number;
  /** Lo que le queda al negocio (cobrado − pago). Puede ser negativo. */
  resultadoNegocio: number;
}

export function sumPostreSales(lines: PostreSaleLine[]): PostreTotals {
  const t: PostreTotals = {
    unidadesGrandes: 0, unidadesChicas: 0, unidades: 0,
    bruto: 0, descuentos: 0, cobrado: 0,
    pagoGrandes: 0, pagoChicos: 0, pago: 0,
    resultadoNegocio: 0,
  };
  for (const l of lines) {
    t.unidades += l.quantity;
    t.bruto += l.gross;
    t.descuentos += l.discount;
    t.cobrado += l.net;
    t.pago += l.payout;
    if (l.size === 'GRANDE') {
      t.unidadesGrandes += l.quantity;
      t.pagoGrandes += l.payout;
    } else {
      t.unidadesChicas += l.quantity;
      t.pagoChicos += l.payout;
    }
  }
  t.resultadoNegocio = round2(t.cobrado - t.pago);
  for (const k of ['bruto', 'descuentos', 'cobrado', 'pago', 'pagoGrandes', 'pagoChicos'] as const) {
    t[k] = round2(t[k]);
  }
  return t;
}

/** Guarda una tarifa nueva. NO pisa las anteriores: rige de ahora en adelante. */
export async function savePostrePayoutRates(
  values: Partial<Record<PostreSize, number>>,
  userId?: string
): Promise<void> {
  const rates = await PostrePayoutRates.load();
  const effectiveFrom = new Date();

  for (const size of ['GRANDE', 'CHICO'] as PostreSize[]) {
    const nuevo = values[size];
    if (nuevo === undefined) continue;
    if (!Number.isFinite(nuevo) || nuevo < 0) throw new Error('El pago no puede ser negativo');
    // Sin cambios no versionamos: si no, cada "Guardar" dejaría una fila igual a
    // la anterior y el historial de tarifas se llenaría de ruido.
    if (Math.abs(rates.current(size) - nuevo) < 0.01) continue;
    await prisma.postrePayoutRate.create({
      data: { size, amount: nuevo, effectiveFrom, createdById: userId ?? null },
    });
  }
}

/** Historial de tarifas, de la más nueva a la más vieja (para mostrarlo en el panel). */
export async function listPostrePayoutRates(limit = 20) {
  const rows = await prisma.postrePayoutRate.findMany({
    orderBy: { effectiveFrom: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    size: r.size as PostreSize,
    amount: toNumber(r.amount),
    effectiveFrom: r.effectiveFrom,
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
