import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';

describe('GET /v1/products/:id/reviews', () => {
  it('returns visible reviews sorted by score DESC by default', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const u1 = await makeUser({ email: `a-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `b-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `c-${Date.now()}@t.l` });
    await makeReview({ userId: u1.id, productId: product.id, score: 0.2 });
    await makeReview({ userId: u2.id, productId: product.id, score: 0.8 });
    await makeReview({ userId: u3.id, productId: product.id, score: 0.5 });

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/reviews` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(3);
    expect(body.items[0].score).toBeGreaterThanOrEqual(body.items[1].score);
    expect(body.items[1].score).toBeGreaterThanOrEqual(body.items[2].score);
    await app.close();
  });

  it('hides non-visible reviews from non-owners', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const owner = await makeUser({ email: `owner-${Date.now()}@t.l` });
    const other = await makeUser({ email: `other-${Date.now()}@t.l` });
    await makeReview({ userId: owner.id, productId: product.id, status: 'hidden' });
    await makeReview({ userId: other.id, productId: product.id, status: 'visible' });

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/reviews` });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].userId).toBe(other.id);
    await app.close();
  });

  it('returns 400 for an invalid sort', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/reviews?sort=bogus`,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('supports sort=new (createdAt DESC)', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const u1 = await makeUser({ email: `n1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `n2-${Date.now()}@t.l` });
    const r1 = await makeReview({ userId: u1.id, productId: product.id });
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await makeReview({ userId: u2.id, productId: product.id });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/reviews?sort=new`,
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toEqual([r2.id, r1.id]);
    await app.close();
  });
});
