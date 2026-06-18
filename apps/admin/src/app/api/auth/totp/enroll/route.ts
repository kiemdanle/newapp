// apps/admin/src/app/api/auth/totp/enroll/route.ts
import { NextResponse } from 'next/server';
import { adminTotpEnrollRequestSchema } from '@expyrico/shared';
import { getAdminEnv } from '@/lib/env';

export async function POST(req: Request) {
  const env = getAdminEnv();
  let parsed;
  try {
    parsed = adminTotpEnrollRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { code: 'validation_error', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/totp/enroll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  // No cookies/session here — gated by the enrollmentChallenge, not a session.
  // Pass the upstream payload straight through (secret, qrCodeDataUrl, recoveryCodes).
  return NextResponse.json(body, { status: upstream.status });
}
