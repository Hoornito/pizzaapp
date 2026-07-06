import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/menu', req.url));
    }
  }

  // Auth routes redirect when already logged in
  if ((pathname === '/login' || pathname === '/register') && session) {
    if (session.user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
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
