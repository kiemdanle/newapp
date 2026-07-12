import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(userId: string) {
  const token = await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 });
  return { authorization: `Bearer ${token}` };
}

describe('POST /v1/reviews/:id/helpful', () => {
  it('inserts a helpful vote and is idempotent on upsert', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `va-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `vv-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id, body: 'has a comment' });
    const headers = await h(voter.id);
    const a = await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, headers, payload: { helpful: true } });
    const b = await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, headers, payload: { helpful: true } });
    expect(a.statusCode).toBe(204);
    expect(b.statusCode).toBe(204);
    const votes = await getPrisma().reviewVote.count({ where: { reviewId: r.id } });
    expect(votes).toBe(1);
    const after = await getPrisma().review.findUnique({ where: { id: r.id } });
    expect(after?.helpfulCount).toBe(1);
    await app.close();
  });

  it('switches a vote from helpful to not-helpful (still one row)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `s1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `s2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id, body: 'comment' });
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, headers: await h(voter.id), payload: { helpful: true } });
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, headers: await h(voter.id), payload: { helpful: false } });
    const all = await getPrisma().reviewVote.findMany({ where: { reviewId: r.id } });
    expect(all).toHaveLength(1);
    expect(all[0]!.value).toBe('not_helpful');
    await app.close();
  });

  it('rejects voting on a review with no comment (422)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `nc1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `nc2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await getPrisma().review.create({
      data: { userId: author.id, productId: product.id, rating: 'buy_again', body: null, status: 'visible' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/reviews/${r.id}/helpful`,
      headers: await h(voter.id),
      payload: { helpful: true },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('review_has_no_comment');
    await app.close();
  });

  it('returns 404 for unknown review', async () => {
    const app = await buildServer();
    const voter = await makeUser({ email: `nf-${Date.now()}@t.l` });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/reviews/00000000-0000-0000-0000-0000000000bb/helpful`,
      headers: await h(voter.id),
      payload: { helpful: true },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ua-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id, body: 'comment' });
    const res = await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, payload: { helpful: true } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('DELETE /v1/reviews/:id/helpful', () => {
  it('removes the caller vote and recomputes counts', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `d1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `d2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id, body: 'comment' });
    const headers = await h(voter.id);
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/helpful`, headers, payload: { helpful: true } });
    const del = await app.inject({ method: 'DELETE', url: `/v1/reviews/${r.id}/helpful`, headers });
    expect(del.statusCode).toBe(204);
    const after = await getPrisma().reviewVote.count({ where: { reviewId: r.id } });
    expect(after).toBe(0);
    const review = await getPrisma().review.findUnique({ where: { id: r.id } });
    expect(review?.helpfulCount).toBe(0);
    await app.close();
  });
});
