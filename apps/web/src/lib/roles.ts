import type { Role } from '@prisma/client';

/**
 * Roles con acceso al panel de administración. ADMIN ve todo; MOSTRADOR es el
 * perfil de una persona de mostrador: puede cargar pedidos, ver pedidos, menú,
 * etc., pero NO las secciones sensibles (finanzas, empleados, reportes, usuarios).
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
