import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';

async function h(userId: string) {
  const token = await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/me/reviews', () => {
  it('returns only the caller reviews including hidden ones', async () => {
    const app = await buildServer();
    const me = await makeUser({ email: `me-${Date.now()}@t.l` });
    const other = await makeUser({ email: `not-me-${Date.now()}@t.l` });
    const p1 = await makeProduct();
    const p2 = await makeProduct();
    const p3 = await makeProduct();
    await makeReview({ userId: me.id, productId: p1.id, rating: 'buy_again' });
    await makeReview({ userId: me.id, productId: p2.id, rating: 'wont_buy', status: 'hidden' });
    await makeReview({ userId: other.id, productId: p3.id, rating: 'buy_again' });
    const res = await app.inject({ method: 'GET', url: '/v1/me/reviews', headers: await h(me.id) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((r: { userId: string }) => r.userId === me.id)).toBe(true);
    await app.close();
  });

  it('excludes soft-deleted reviews', async () => {
    const app = await buildServer();
    const me = await makeUser({ email: `md-${Date.now()}@t.l` });
    const p1 = await makeProduct();
    const p2 = await makeProduct();
    await makeReview({ userId: me.id, productId: p1.id, rating: 'buy_again' });
    await makeReview({ userId: me.id, productId: p2.id, rating: 'wont_buy', status: 'deleted' });
    const res = await app.inject({ method: 'GET', url: '/v1/me/reviews', headers: await h(me.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/me/reviews' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
