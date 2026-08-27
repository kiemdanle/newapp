// apps/admin/src/app/api/auth/refresh-redirect/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import {
  buildSetCookie,
  COOKIE_NAMES,
  ACCESS_MAX_AGE_SEC,
  REFRESH_MAX_AGE_SEC,
} from '@/lib/cookies';
import { buildPublicUrl } from '@/lib/request-origin';
function safeNext(raw: string | null): string {
  // Only allow same-origin absolute paths to avoid open-redirect.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export async function GET(req: Request) {
  const env = getAdminEnv();
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const reqHeaders = await headers();

  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  if (!refresh) {
    return NextResponse.redirect(buildPublicUrl(reqHeaders, '/login'));
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!upstream.ok) {
    // Only clear cookies if the refresh token was explicitly rejected (401/403)
    if (upstream.status === 401 || upstream.status === 403) {
      const res = NextResponse.redirect(buildPublicUrl(reqHeaders, '/login'));
      for (const name of [COOKIE_NAMES.access, COOKIE_NAMES.refresh, COOKIE_NAMES.csrf]) {
        res.headers.append(
          'Set-Cookie',
          buildSetCookie({
            name,
            value: '',
            maxAgeSec: 0,
            httpOnly: name !== COOKIE_NAMES.csrf,
            secure: env.cookieSecure,
            sameSite: 'lax',
            domain: env.cookieDomain,
          }),
        );
      }
      return res;
    }
    return NextResponse.redirect(buildPublicUrl(reqHeaders, '/login'));
  }

  const body = (await upstream.json()) as {
    tokens?: { accessToken: string; refreshToken: string };
  };
  const tokens = body.tokens;
  if (!tokens) {
    return NextResponse.redirect(buildPublicUrl(reqHeaders, '/login'));
  }

  // A Route Handler response MAY set cookies (unlike a Server Component render).
  const res = NextResponse.redirect(buildPublicUrl(reqHeaders, next));
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
