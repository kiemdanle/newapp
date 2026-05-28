// apps/admin/src/app/api/auth/refresh-redirect/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';

const ACCESS_MAX_AGE_SEC = 60 * 15;
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function safeNext(raw: string | null): string {
  // Only allow same-origin absolute paths to avoid open-redirect.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export async function GET(req: Request) {
  const env = getAdminEnv();
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));

  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  if (!refresh) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!upstream.ok) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const body = (await upstream.json()) as {
    tokens?: { accessToken: string; refreshToken: string };
  };
  const tokens = body.tokens;
  if (!tokens) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // A Route Handler response MAY set cookies (unlike a Server Component render).
  const res = NextResponse.redirect(new URL(next, req.url));
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.access,
      value: tokens.accessToken,
      maxAgeSec: ACCESS_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.refresh,
      value: tokens.refreshToken,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  return res;
}
