import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(userId: string) {
  const token = await issueAccessToken({ sub: userId, role: 'user' });
  return { authorization: `Bearer ${token}` };
}

describe('PATCH /v1/reviews/:id', () => {
  it('updates own review and returns new state', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id, rating: 'buy_again_on_sale', body: 'meh' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(user.id),
      payload: { rating: 'buy_again', body: 'changed my mind' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rating).toBe('buy_again');
    expect(res.json().body).toBe('changed my mind');
    await app.close();
  });

  it("rejects updating someone else's review with 403", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `o-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `i-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: owner.id, productId: product.id });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(intruder.id),
      payload: { rating: 'wont_buy' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('marks edited review as hidden when new body trips profanity filter', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id, body: 'fine' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(user.id),
      payload: { body: 'utter shit' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('hidden');
    await app.close();
  });

  it('returns 404 for unknown id', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/00000000-0000-0000-0000-0000000000aa`,
      headers: await h(user.id),
      payload: { rating: 'buy_again' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('DELETE /v1/reviews/:id', () => {
  it('soft-deletes own review', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/reviews/${r.id}`, headers: await h(user.id) });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().review.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('deleted');
    await app.close();
  });

  it("rejects deleting someone else's review", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `do-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `di-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: owner.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/reviews/${r.id}`, headers: await h(intruder.id) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
