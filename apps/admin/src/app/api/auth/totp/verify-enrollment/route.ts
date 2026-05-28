// apps/admin/src/app/api/auth/totp/verify-enrollment/route.ts
import { NextResponse } from 'next/server';
import { adminTotpVerifyEnrollmentRequestSchema } from '@pantry/shared';
import { getAdminEnv } from '@/lib/env';

export async function POST(req: Request) {
  const env = getAdminEnv();
  let parsed;
  try {
    parsed = adminTotpVerifyEnrollmentRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { code: 'validation_error', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/totp/verify-enrollment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });

  // Success is 204 empty; do not attempt to parse a body. No session is granted —
  // the client must return to the password step and log in again.
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
