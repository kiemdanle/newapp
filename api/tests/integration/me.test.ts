import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

async function authedTokens(app: Awaited<ReturnType<typeof buildServer>>) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: 'me@example.com',
      password: 'correct-horse-battery-staple',
      firstName: 'Me',
      lastName: 'User',
    },
  });
  await getPrisma().user.update({
    where: { email: 'me@example.com' },
    data: { emailVerifiedAt: new Date() },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'me@example.com', password: 'correct-horse-battery-staple' },
  });
  return login.json().tokens as { accessToken: string };
}

describe('GET /v1/auth/me', () => {
  it('returns the authenticated user', async () => {
    const app = await buildServer();
    const t = await authedTokens(app);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${t.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('me@example.com');
    await app.close();
  });

  it('returns 401 without a token', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('PATCH /v1/me updates profile', async () => {
    const app = await buildServer();
    const t = await authedTokens(app);
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: `Bearer ${t.accessToken}` },
      payload: { firstName: 'New', themePreference: 'bento' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.firstName).toBe('New');
    expect(body.themePreference).toBe('bento');
    await app.close();
  });
});
