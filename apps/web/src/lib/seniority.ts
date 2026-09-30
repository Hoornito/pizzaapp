/**
 * Antigüedad de un empleado en años y meses.
 *
 * Particularidad del negocio: el empleado puede "pre-cobrar" años de
 * antigüedad (se le pagan por adelantado, como un despido parcial). La
 * antigüedad oficial sigue contando desde la fecha de ingreso, pero la vigente
 * —la que se paga si lo despiden o renuncia— es la total menos esos años.
 */

export interface YearsMonths {
  years: number;
  months: number;
}

/** Fecha (Y-M-D) en la zona del negocio (Argentina, UTC-3, sin horario de verano). */
function arDateParts(d: Date): [number, number, number] {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return [ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()];
}

/** Meses completos entre la fecha de ingreso y `now` (0 si todavía no ingresó). */
export function seniorityMonths(hireDate: Date | string, now: Date = new Date()): number {
  const [y1, m1, d1] = arDateParts(new Date(hireDate));
  const [y2, m2, d2] = arDateParts(now);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return Math.max(0, months);
}

export function toYearsMonths(totalMonths: number): YearsMonths {
  const m = Math.max(0, totalMonths);
  return { years: Math.floor(m / 12), months: m % 12 };
}

export interface Seniority {
  /** Antigüedad oficial, desde la fecha de ingreso. */
  total: YearsMonths;
  /** Años cobrados por adelantado. */
  prepaidYears: number;
  /** Lo que se paga al irse: total − años pre-cobrados. */
  current: YearsMonths;
}

export function computeSeniority(hireDate: Date | string, prepaidYears: number, now: Date = new Date()): Seniority {
  const months = seniorityMonths(hireDate, now);
  return {
    total: toYearsMonths(months),
    prepaidYears,
    current: toYearsMonths(months - prepaidYears * 12),
  };
}

/** "4 años y 7 meses", "1 año", "3 meses", "0 meses". */
export function formatYearsMonths({ years, months }: YearsMonths): string {
  const y = years === 1 ? '1 año' : `${years} años`;
  const m = months === 1 ? '1 mes' : `${months} meses`;
  if (years && months) return `${y} y ${m}`;
  if (years) return y;
  return m;
}
