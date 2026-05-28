// apps/admin/src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { CSRF_HEADER, isCsrfValid } from '@/lib/csrf';

export async function POST(req: Request) {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(COOKIE_NAMES.csrf)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER) ?? undefined;
  if (!isCsrfValid(csrfCookie, csrfHeader)) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403 });
  }

  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  if (refresh) {
    await fetch(`${env.apiBaseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
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
