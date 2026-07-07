import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { isStaff, isAdmin, isAdminOnlyPath } from '@/lib/roles';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    // Solo personal (ADMIN o MOSTRADOR) entra al panel.
    if (!isStaff(session.user.role)) {
      return NextResponse.redirect(new URL('/menu', req.url));
    }
    // El mostrador no puede entrar a las secciones exclusivas de ADMIN.
    if (!isAdmin(session.user.role) && isAdminOnlyPath(pathname)) {
      return NextResponse.redirect(new URL('/admin/pos', req.url));
    }
  }

  // Auth routes redirect when already logged in
  if ((pathname === '/login' || pathname === '/register') && session) {
    if (session.user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    // El mostrador arranca directo en la pantalla de carga de pedidos.
    if (session.user.role === 'MOSTRADOR') {
      return NextResponse.redirect(new URL('/admin/pos', req.url));
    }
    return NextResponse.redirect(new URL('/menu', req.url));
  }

  // Protected customer routes
  if (['/profile', '/orders', '/checkout'].some((p) => pathname.startsWith(p))) {
    if (!session) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public|uploads).*)'],
};
