// apps/admin/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES } from './lib/cookies';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/api/auth', '/favicon'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasAccess = req.cookies.has(COOKIE_NAMES.access);
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (!hasAccess && !isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasAccess && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
