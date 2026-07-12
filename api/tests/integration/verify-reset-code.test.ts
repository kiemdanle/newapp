import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetCodeEmail: vi.fn(async () => undefined),
}));

async function registerVerifiedAndRequestCode(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
): Promise<string> {
  const { sendPasswordResetCodeEmail } = await import('../../src/services/auth/email.js');
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: 'correct-horse-battery-staple', firstName: 'A', lastName: 'B' },
  });
  await getPrisma().user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email } });
  const code = vi.mocked(sendPasswordResetCodeEmail).mock.calls.at(-1)?.[1];
  return code as string;
}

describe('POST /v1/auth/verify-reset-code', () => {
  it('returns a ticket for a valid code and sets verifiedAt + ticketHash', async () => {
    const app = await buildServer();
    const code = await registerVerifiedAndRequestCode(app, 'v1@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'v1@example.com', code },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().resetTicket).toBe('string');

    const row = await getPrisma().passwordReset.findFirst({});
    expect(row!.verifiedAt).not.toBeNull();
    expect(row!.ticketHash).not.toBeNull();
    await app.close();
  });

  it('counts a wrong code (attempts incremented) and returns a generic error', async () => {
    const app = await buildServer();
    await registerVerifiedAndRequestCode(app, 'v2@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'v2@example.com', code: '000000' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');

    const row = await getPrisma().passwordReset.findFirst({});
    expect(row!.attempts).toBe(1);
    await app.close();
  });

  it('rejects even the correct code after 5 failed attempts (cap)', async () => {
    const app = await buildServer();
    const code = await registerVerifiedAndRequestCode(app, 'v3@example.com');

    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify-reset-code',
        payload: { email: 'v3@example.com', code: '000000' },
      });
      expect(r.statusCode).toBe(400);
    }
    // 6th attempt with the CORRECT code must still be rejected.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'v3@example.com', code },
    });
    expect(res.statusCode).toBe(400);

    const row = await getPrisma().passwordReset.findFirst({});
    expect(row!.attempts).toBe(5); // capped, not 6
    expect(row!.verifiedAt).toBeNull();
    await app.close();
  });

  it('rejects an expired code', async () => {
    const app = await buildServer();
    await registerVerifiedAndRequestCode(app, 'v4@example.com');
    // Force the code to be expired.
    await getPrisma().passwordReset.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'v4@example.com', code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns the same generic error for an unknown email', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'ghost@example.com', code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('concurrent wrong guesses never exceed the attempt cap of 5', async () => {
    const app = await buildServer();
    await registerVerifiedAndRequestCode(app, 'race@example.com');

    // Fire 20 wrong guesses in parallel against the same row. Each request uses a
    // DISTINCT forwarded IP so the per-IP auth limiter (30/min) sees one hit per
    // IP and never trips — this test targets the row-level atomic cap (keyed on
    // userId, RT-2), which the IP limiter would otherwise mask by returning 429.
    const results = await Promise.all(
      Array.from({ length: 20 }, (_unused, i) =>
        app.inject({
          method: 'POST',
          url: '/v1/auth/verify-reset-code',
          payload: { email: 'race@example.com', code: '000000' },
          headers: { 'x-forwarded-for': `198.51.100.${i + 1}` },
        }),
      ),
    );
    // All are rejected (wrong code), none 500.
    for (const r of results) expect(r.statusCode).toBe(400);

    // The race-safe conditional UPDATE caps attempts at exactly 5.
    const row = await getPrisma().passwordReset.findFirst({});
    expect(row!.attempts).toBe(5);
    await app.close();
  });
});
