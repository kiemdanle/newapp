import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetCodeEmail: vi.fn(async () => undefined),
}));

async function registerAndVerify(app: Awaited<ReturnType<typeof buildServer>>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: 'correct-horse-battery-staple', firstName: 'A', lastName: 'B' },
  });
  await getPrisma().user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
}

describe('forgot/reset password (OTP)', () => {
  it('forgot emails a 6-digit code; verify returns a ticket; reset sets the new password', async () => {
    const { sendPasswordResetCodeEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await registerAndVerify(app, 'fr@example.com');

    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'fr@example.com' },
    });
    expect(forgot.statusCode).toBe(204);

    // The code is read from the mocked email module, not from logs.
    const code = vi.mocked(sendPasswordResetCodeEmail).mock.calls.at(-1)?.[1];
    expect(code).toMatch(/^\d{6}$/);

    const row = await getPrisma().passwordReset.findFirst({});
    expect(row).not.toBeNull();
    expect(row!.codeHash).toBeTruthy();

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'fr@example.com', code },
    });
    expect(verify.statusCode).toBe(200);
    const { resetTicket } = verify.json();
    expect(typeof resetTicket).toBe('string');
    expect(resetTicket.length).toBeGreaterThan(0);

    const afterVerify = await getPrisma().passwordReset.findUnique({ where: { id: row!.id } });
    expect(afterVerify!.verifiedAt).not.toBeNull();
    expect(afterVerify!.ticketHash).not.toBeNull();

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { resetTicket, password: 'a-new-correct-horse-1234' },
    });
    expect(reset.statusCode).toBe(204);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'fr@example.com', password: 'a-new-correct-horse-1234' },
    });
    expect(login.statusCode).toBe(200);
    await app.close();
  });

  it('forgot returns 204 even for unknown email (no leak) and writes no row', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'noone@example.com' },
    });
    expect(res.statusCode).toBe(204);
    expect(await getPrisma().passwordReset.count()).toBe(0);
    await app.close();
  });

  it('forgot returns 204 for a suspended account without emailing', async () => {
    const { sendPasswordResetCodeEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await registerAndVerify(app, 'susp@example.com');
    await getPrisma().user.update({ where: { email: 'susp@example.com' }, data: { status: 'suspended' } });
    vi.mocked(sendPasswordResetCodeEmail).mockClear();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'susp@example.com' },
    });
    expect(res.statusCode).toBe(204);
    expect(await getPrisma().passwordReset.count()).toBe(0);
    expect(sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    await app.close();
  });

  it('a second forgot request replaces the prior code (single active row)', async () => {
    const { sendPasswordResetCodeEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await registerAndVerify(app, 'replace@example.com');

    await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: 'replace@example.com' } });
    const firstCode = vi.mocked(sendPasswordResetCodeEmail).mock.calls.at(-1)?.[1];
    await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: 'replace@example.com' } });

    // Exactly one active row remains.
    expect(await getPrisma().passwordReset.count()).toBe(1);
    // The first code is now dead.
    const stale = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'replace@example.com', code: firstCode },
    });
    expect(stale.statusCode).toBe(400);
    await app.close();
  });

  it('per-account throttle: 4th forgot within the window returns 204 but does not email', async () => {
    const { sendPasswordResetCodeEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await registerAndVerify(app, 'throttle@example.com');
    vi.mocked(sendPasswordResetCodeEmail).mockClear();

    for (let i = 0; i < 3; i++) {
      const r = await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: 'throttle@example.com' } });
      expect(r.statusCode).toBe(204);
    }
    expect(vi.mocked(sendPasswordResetCodeEmail)).toHaveBeenCalledTimes(3);

    const fourth = await app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: 'throttle@example.com' } });
    expect(fourth.statusCode).toBe(204);
    // Still only 3 emails — the 4th was throttled.
    expect(vi.mocked(sendPasswordResetCodeEmail)).toHaveBeenCalledTimes(3);
    await app.close();
  });

  it('reset rejects a bogus ticket', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { resetTicket: 'nope', password: 'a-new-correct-horse-1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });
});
