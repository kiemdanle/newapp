import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getConfig } from '../../src/config.js';

describe('auth rate limiting', () => {
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
});
