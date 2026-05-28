import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('forgot/reset password', () => {
  it('forgot creates a reset token; reset sets new password', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'fr@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });

    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'fr@example.com' },
    });
    expect(forgot.statusCode).toBe(204);
    const reset = await getPrisma().passwordReset.findFirst({});
    expect(reset).not.toBeNull();

    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().passwordReset.update({
      where: { id: reset!.id },
      data: { tokenHash: hashToken(plain) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: plain, password: 'a-new-correct-horse-1234' },
    });
    expect(res.statusCode).toBe(204);

    await getPrisma().user.update({
      where: { email: 'fr@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'fr@example.com', password: 'a-new-correct-horse-1234' },
    });
    expect(login.statusCode).toBe(200);
    await app.close();
  });

  it('forgot returns 204 even for unknown email (no leak)', async () => {
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

  it('reset rejects bogus token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: 'nope', password: 'a-new-correct-horse-1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });
});
