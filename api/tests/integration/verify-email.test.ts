import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('email verification', () => {
  it('verifies an email with a valid token', async () => {
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
    const user = await getPrisma().user.findUnique({ where: { email: 've@example.com' } });
    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().emailToken.create({
      data: {
        userId: user!.id,
        tokenHash: hashToken(plain),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/verify-email?token=${plain}`,
    });
    expect(res.statusCode).toBe(200);
    const after = await getPrisma().user.findUnique({ where: { email: 've@example.com' } });
    expect(after?.emailVerifiedAt).not.toBeNull();
    await app.close();
  });

  it('rejects an unknown token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/verify-email?token=nope',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('rejects a re-used token', async () => {
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
    const user = await getPrisma().user.findUnique({ where: { email: 'r@example.com' } });
    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().emailToken.create({
      data: {
        userId: user!.id,
        tokenHash: hashToken(plain),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await app.inject({ method: 'GET', url: `/v1/auth/verify-email?token=${plain}` });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/verify-email?token=${plain}`,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('resend creates a fresh token for an unverified user', async () => {
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
    await app.close();
  });
});
