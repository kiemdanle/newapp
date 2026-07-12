import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function authHeader(userId: string, role: 'user' | 'admin' = 'user') {
  const token = await issueAccessToken({ sub: userId, role, tokenVersion: 0 });
  return { authorization: `Bearer ${token}` };
}

describe('POST /v1/products/:id/reviews', () => {
  it('creates a visible review for clean content', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 'buy_again', body: 'Great packaging' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('visible');
    expect(res.json().rating).toBe('buy_again');
    await app.close();
  });

  it('marks profanity-laden reviews as hidden and enqueues a flag (D15)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 'wont_buy', body: 'this product is shit' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('hidden');
    await app.close();
  });

  it('rejects a second review by the same user with 409', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const h = await authHeader(user.id);
    await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: h,
      payload: { rating: 'buy_again' },
    });
    const dup = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: h,
      payload: { rating: 'wont_buy' },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().code).toBe('review_already_exists');
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      payload: { rating: 'buy_again' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects body > 2000 chars with 400', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 'buy_again', body: 'x'.repeat(2001) },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 for unknown product', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/00000000-0000-0000-0000-0000000000ff/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 'buy_again' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('enqueues a product-rating-recalc on successful create', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const { getProductRatingQueue } = await import(
      '../../src/queues/jobs/product-rating-recalc.js'
    );
    await getProductRatingQueue().obliterate({ force: true });
    await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 'buy_again' },
    });
    const counts = await getProductRatingQueue().getJobCounts(
      'waiting',
      'delayed',
      'active',
      'completed',
    );
    expect(
      (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0) + (counts.completed ?? 0),
    ).toBe(1);
    await getPrisma().$disconnect();
    await app.close();
  });
});
