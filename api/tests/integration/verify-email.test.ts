import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetCodeEmail: vi.fn(async () => undefined),
}));

describe('email verification', () => {
  it('verifies an email with a valid 6-digit code', async () => {
    const { sendVerificationEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 've@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'V',
        lastName: 'E',
      },
    });
    const code = vi.mocked(sendVerificationEmail).mock.calls.at(-1)?.[1];

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: 've@example.com', code },
    });
    expect(res.statusCode).toBe(200);
    const after = await getPrisma().user.findUnique({ where: { email: 've@example.com' } });
    expect(after?.emailVerifiedAt).not.toBeNull();
    await app.close();
  });

  it('rejects an unknown code', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: 'missing@example.com', code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('rejects a re-used code', async () => {
    const { sendVerificationEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'r@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const code = vi.mocked(sendVerificationEmail).mock.calls.at(-1)?.[1];
    await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: 'r@example.com', code },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: 'r@example.com', code },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('resend creates and sends a fresh 6-digit code for an unverified user', async () => {
    const { sendVerificationEmail } = await import('../../src/services/auth/email.js');
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 's@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const before = await getPrisma().emailToken.count();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/resend-verification',
      payload: { email: 's@example.com' },
    });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().emailToken.count();
    expect(after).toBe(before + 1);
    expect(sendVerificationEmail).toHaveBeenLastCalledWith('s@example.com', expect.stringMatching(/^\d{6}$/));
    await app.close();
  });
});
