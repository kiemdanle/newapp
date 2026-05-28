import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

async function loginAndGetTokens(app: Awaited<ReturnType<typeof buildServer>>) {
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
  await getPrisma().user.update({
    where: { email: 'r@example.com' },
    data: { emailVerifiedAt: new Date() },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'r@example.com', password: 'correct-horse-battery-staple' },
  });
  return res.json().tokens as { accessToken: string; refreshToken: string };
}

describe('POST /v1/auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const app = await buildServer();
    const t = await loginAndGetTokens(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tokens.refreshToken).not.toBe(t.refreshToken);
    expect(body.tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('rejects an already-rotated token (replay)', async () => {
    const app = await buildServer();
    const t = await loginAndGetTokens(app);
    await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('rejects a bogus token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'not-real' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
