// apps/admin/src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminLoginRequestSchema } from '@expyrico/shared';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { generateCsrfToken } from '@/lib/csrf';

const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const ACCESS_MAX_AGE_SEC = 60 * 15;

export async function POST(req: Request) {
  let env: ReturnType<typeof getAdminEnv>;
  try {
    env = getAdminEnv();
  } catch (err) {
    return NextResponse.json(
      { code: 'config_error', detail: (err as Error).message },
      { status: 500 },
    );
  }

  let parsed;
  try {
    parsed = adminLoginRequestSchema.parse(await req.json());
  } catch (err) {
    const detail = err instanceof ZodError
      ? err.issues.map((i) => i.message).join('; ')
      : (err as Error).message;
    return NextResponse.json(
      { code: 'validation_error', detail },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  // Case 1: admin needs TOTP — propagate challengeToken to the client (no cookies yet)
  if (body.requiresTotp === true && typeof body.challengeToken === 'string') {
    return NextResponse.json(
      { requiresTotp: true, challengeToken: body.challengeToken },
      { status: 200 },
    );
  }

  // Case 2: freshly-promoted admin with no TOTP yet — must enroll before any
  // session is granted. Propagate the enrollmentChallenge to the client; NO
  // cookies/session are issued here (mirrors the requiresTotp branch above).
  if (body.requiresTotpEnrollment === true && typeof body.enrollmentChallenge === 'string') {
    return NextResponse.json(
      { requiresTotpEnrollment: true, enrollmentChallenge: body.enrollmentChallenge },
      { status: 200 },
    );
  }

  // Case 3: full login (shouldn't happen for admin role; defensive)
  return finalizeSession(body, env);
}

interface UpstreamAuth {
  user: { role: 'user' | 'admin' };
  tokens: { accessToken: string; refreshToken: string };
}

export function finalizeSession(
  body: Record<string, unknown>,
  env: ReturnType<typeof getAdminEnv>,
) {
  const auth = body as unknown as UpstreamAuth;

  if (auth.user?.role !== 'admin') {
    return NextResponse.json(
      { code: 'forbidden', detail: 'Admin role required' },
      { status: 403 },
    );
  }

  const csrf = generateCsrfToken();
  const res = NextResponse.json({ user: auth.user }, { status: 200 });
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.access,
      value: auth.tokens.accessToken,
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
      value: auth.tokens.refreshToken,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.csrf,
      value: csrf,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: false,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  return res;
}
