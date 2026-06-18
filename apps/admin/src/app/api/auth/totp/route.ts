// apps/admin/src/app/api/auth/totp/route.ts
import { NextResponse } from 'next/server';
import { adminTotpRequestSchema } from '@expyrico/shared';
import { getAdminEnv } from '@/lib/env';
import { finalizeSession } from '../login/route';

export async function POST(req: Request) {
  const env = getAdminEnv();
  let parsed;
  try {
    parsed = adminTotpRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { code: 'validation_error', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/totp/challenge-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  return finalizeSession(body, env);
}
