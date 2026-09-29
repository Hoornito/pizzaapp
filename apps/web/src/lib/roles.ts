import type { Role } from '@prisma/client';

/**
 * Roles con acceso al panel de administración. ADMIN ve todo; MOSTRADOR es el
 * perfil de una persona de mostrador: puede cargar pedidos, ver pedidos, menú,
 * etc., pero NO las secciones sensibles (dashboard, finanzas, empleados,
 * reportes, usuarios). La caja la abre y cierra desde la pantalla Mostrador.
 */
export const STAFF_ROLES: Role[] = ['ADMIN', 'MOSTRADOR'];

/**
 * Secciones del panel exclusivas de ADMIN. El mostrador no las ve en el menú ni
 * puede entrar por URL (el middleware lo redirige). Las APIs correspondientes
 * siguen exigiendo ADMIN aparte.
 */
export const ADMIN_ONLY_PREFIXES = [
  '/admin/dashboard',
  '/admin/employees',
  '/admin/finance',
  '/admin/reports',
  '/admin/users',
];

/** ¿Tiene acceso al panel admin (ADMIN o MOSTRADOR)? */
export function isStaff(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'MOSTRADOR';
}

/** ¿Es ADMIN (acceso total)? */
export function isAdmin(role?: string | null): boolean {
  return role === 'ADMIN';
}

/** ¿La ruta pedida es una sección exclusiva de ADMIN? */
export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

/**
 * Secciones que, aun siendo ADMIN, piden un código para entrar: la compu del
 * admin está en el mismo lugar que el mostrador y cualquiera puede mirar la
 * pantalla. Se desbloquean al entrar y se vuelven a bloquear al salir.
 */
export const LOCKED_SECTION_PREFIXES = [
  '/admin/dashboard',
  '/admin/reports',
  '/admin/finance',
  '/admin/employees',
];

/** ¿La ruta es una sección que pide código? */
export function isLockedSectionPath(pathname: string): boolean {
  return LOCKED_SECTION_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
