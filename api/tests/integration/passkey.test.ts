import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('passkey routes', () => {
  it('register/options requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/options',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('register/options returns a challenge for an authenticated user', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'p@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    await getPrisma().user.update({
      where: { email: 'p@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'p@example.com', password: 'correct-horse-battery-staple' },
    });
    const tok = login.json().tokens.accessToken;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/options',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().challenge).toBeTruthy();
    expect(res.json().rp.id).toBe('localhost');
    await app.close();
  });

  it('login/options for an unknown email returns generic options (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: { email: 'nobody@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().challenge).toBeTruthy();
    await app.close();
  });
});
