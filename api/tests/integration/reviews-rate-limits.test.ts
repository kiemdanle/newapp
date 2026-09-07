import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { reviewWriteRateLimit, reviewVoteRateLimit } from '../../src/routes/reviews/rate-limits.js';

async function authHeader(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}` };
}

describe('reviews rate limiting', () => {
  it('enforces 15/min limit on write endpoints and returns 429', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `rl-write-${Date.now()}@t.l` });
    const product = await makeProduct();
    const headers = {
      ...(await authHeader(user.id)),
      'x-forwarded-for': '203.0.113.88',
    };

    let lastStatus = 201;
    // We send up to write limit + 1 requests
    for (let i = 0; i < reviewWriteRateLimit.max + 1; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/products/${product.id}/reviews`,
        headers: {
          ...headers,
          'idempotency-key': `key-${i}-${Date.now()}`,
        },
        payload: { rating: 'buy_again', body: `Review number ${i}` },
      });
      lastStatus = res.statusCode;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('enforces 30/min limit on vote endpoints and returns 429', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `rl-va-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `rl-vv-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id, body: 'Solid product' });
    const headers = {
      ...(await authHeader(voter.id)),
      'x-forwarded-for': '203.0.113.89',
    };

    let lastStatus = 204;
    for (let i = 0; i < reviewVoteRateLimit.max + 1; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/reviews/${review.id}/helpful`,
        headers,
        payload: { helpful: true },
      });
      lastStatus = res.statusCode;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
    await app.close();
  });
});
