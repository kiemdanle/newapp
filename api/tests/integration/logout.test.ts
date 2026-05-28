import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('POST /v1/auth/logout', () => {
  it('revokes the refresh token', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'lo@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    await getPrisma().user.update({
      where: { email: 'lo@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'lo@example.com', password: 'correct-horse-battery-staple' },
    });
    const tokens = login.json().tokens;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(res.statusCode).toBe(204);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    await app.close();
  });

  it('idempotent: returns 204 even for an unknown token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: 'unknown-token' },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});
