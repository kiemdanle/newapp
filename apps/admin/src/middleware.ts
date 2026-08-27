// apps/admin/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES } from './lib/cookies';
import { buildPublicUrl } from './lib/request-origin';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/api/auth', '/favicon'];
const SAFE_PAGE_METHODS = new Set(['GET', 'HEAD']);

export function isUnsafePublicPageMethod(pathname: string, method: string): boolean {
  return PUBLIC_PATHS.includes(pathname) && !SAFE_PAGE_METHODS.has(method);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (isUnsafePublicPageMethod(pathname, req.method)) {
    return new NextResponse(null, { status: 405 });
  }

  const hasAccess = req.cookies.has(COOKIE_NAMES.access);
  const hasRefresh = req.cookies.has(COOKIE_NAMES.refresh);
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  // Case 1: Active access token present
  if (hasAccess) {
    if (isPublicPage) {
      const url = buildPublicUrl(req.headers, '/');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Case 2: Access token missing/expired, but refresh token present -> seamless refresh!
  if (hasRefresh) {
    const url = buildPublicUrl(req.headers, '/api/auth/refresh-redirect');
    url.searchParams.set('next', isPublicPage ? '/' : pathname + search);
    return NextResponse.redirect(url);
  }

  // Case 3: Neither access nor refresh token present
  if (!isPublicPage) {
    const url = buildPublicUrl(req.headers, '/login');
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
