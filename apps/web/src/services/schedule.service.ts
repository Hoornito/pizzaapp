import { prisma } from '@/lib/prisma';

/**
 * Franjas horarias para "Programar para después" en el checkout.
 *
 * Reglas del negocio:
 *  - Solo para HOY.
 *  - Nunca antes de ahora + MIN_LEAD_MINUTES (30 min): la cocina necesita ese
 *    margen y el cliente no puede elegir un horario ya pasado.
 *  - Dentro del horario de atención del día (tabla BusinessHours).
 *
 * Todo se calcula en el servidor, que corre con TZ=America/Argentina/Buenos_Aires,
 * para que el horario no dependa del reloj ni la zona del dispositivo del cliente.
 */

/** Margen mínimo entre "ahora" y la primera franja elegible. */
export const MIN_LEAD_MINUTES = 30;
/** Duración de cada franja. */
export const SLOT_MINUTES = 15;

export interface TimeSlot {
  /** ISO del inicio de la franja (lo que se guarda en Order.scheduledFor). */
  value: string;
  /** "15:30" */
  from: string;
  /** "15:45" */
  to: string;
}

/** "HH:MM" → minutos desde la medianoche. Devuelve null si viene roto. */
function parseHHMM(v: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function fmt(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Rangos de atención de hoy, en minutos desde la medianoche. Son varios porque
 * el local abre en turnos (mediodía y noche): cada turno es un rango aparte, y
 * el bache entre uno y otro no ofrece franjas.
 */
async function todayRanges(now: Date): Promise<{ open: number; close: number }[]> {
  const shifts = await prisma.businessHours.findMany({
    where: { dayOfWeek: now.getDay(), isOpen: true },
    orderBy: { openTime: 'asc' },
  });

  const ranges: { open: number; close: number }[] = [];
  for (const h of shifts) {
    const open = parseHHMM(h.openTime);
    const close = parseHHMM(h.closeTime);
    if (open == null || close == null) continue;
    // Cierre a la medianoche o pasada: para las franjas de HOY, el tope es el
    // fin del día. No ofrecemos franjas de madrugada del día siguiente.
    const end = close <= open ? 24 * 60 : close;
    if (end > open) ranges.push({ open, close: end });
  }
  return ranges;
}

/** Franjas elegibles para hoy. Vacío = no se puede programar (ya cerró o está cerrado). */
export async function getTodaySlots(now = new Date()): Promise<TimeSlot[]> {
  const ranges = await todayRanges(now);
  if (!ranges.length) return [];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // Primera franja posible: ahora + margen, redondeado hacia ARRIBA al múltiplo
  // de SLOT_MINUTES (así "13:16 + 30" no ofrece 13:46 sino 14:00).
  const earliest = Math.ceil((nowMinutes + MIN_LEAD_MINUTES) / SLOT_MINUTES) * SLOT_MINUTES;

  const slots: TimeSlot[] = [];
  for (const { open, close } of ranges) {
    const start = Math.max(open, earliest);
    // La franja tiene que terminar dentro del horario de atención.
    for (let m = start; m + SLOT_MINUTES <= close; m += SLOT_MINUTES) {
      const at = new Date(now);
      at.setHours(Math.floor(m / 60), m % 60, 0, 0);
      slots.push({ value: at.toISOString(), from: fmt(m), to: fmt(m + SLOT_MINUTES) });
    }
  }
  return slots;
}

/**
 * ¿Ese horario es una franja válida ahora mismo? Se usa al crear el pedido: el
 * cliente pudo dejar el checkout abierto mucho rato y la franja que eligió ya
 * puede haber pasado.
 */
export async function isValidSlot(scheduledFor: Date, now = new Date()): Promise<boolean> {
  if (Number.isNaN(scheduledFor.getTime())) return false;
  const slots = await getTodaySlots(now);
  const target = scheduledFor.toISOString();
  return slots.some((s) => s.value === target);
}
