// apps/admin/src/app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { CSRF_HEADER, isCsrfValid } from '@/lib/csrf';

const ACCESS_MAX_AGE_SEC = 60 * 15;
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  const csrfCookie = cookieStore.get(COOKIE_NAMES.csrf)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER) ?? undefined;

  if (!isCsrfValid(csrfCookie, csrfHeader)) {
    return NextResponse.json({ code: 'forbidden', detail: 'CSRF token mismatch' }, { status: 403 });
  }
  if (!refresh) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  const tokens = body.tokens as { accessToken: string; refreshToken: string };
  const res = NextResponse.json({ ok: true });
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
