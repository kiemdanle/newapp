import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getConfig } from '../../src/config.js';

describe('auth rate limiting', () => {
  it('does not let an untrusted forwarding chain choose a new limiter identity', async () => {
    const app = await buildServer();
    const limit = getConfig().rateLimit.authPerIpPerMin;
    let last = 200;
    for (let i = 0; i < limit + 1; i++) {
      last = (await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'nobody@example.com', password: 'correct-horse-battery-staple' },
        // The rightmost value is the client address Nginx forwards. A caller may
        // forge preceding values, but Fastify must not key each one independently.
        headers: { 'x-forwarded-for': `203.0.113.${i}, 198.51.100.8` },
      })).statusCode;
    }
    expect(last).toBe(429);
    await app.close();
  });

  it('returns 429 once the per-IP /v1/auth/* budget is exceeded', async () => {
    const app = await buildServer();
    const limit = getConfig().rateLimit.authPerIpPerMin;
    let last = 200;
    for (let i = 0; i < limit + 1; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'correct-horse-battery-staple',
        },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
    await app.close();
  });

  it('does not throttle authenticated /v1/auth/me requests with the 10/min authPerIp budget', async () => {
    const app = await buildServer();
    const { makeUser } = await import('../helpers/factories.js');
    const { issueAccessToken } = await import('../../src/services/auth/tokens.js');
    const user = await makeUser();
    const token = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: 0 });
    const authHeaders = { authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.9' };

    const limit = getConfig().rateLimit.authPerIpPerMin;
    // Make more requests than the authPerIpPerMin budget (10) from the same IP
    for (let i = 0; i < limit + 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
    }
    await app.close();
  });
});
