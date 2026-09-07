import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function authHeader(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}` };
}

describe('POST /v1/reports', () => {
  it('creates an open report and returns 201', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `rep-${Date.now()}@t.l` });
    const author = await makeUser({ email: `rev-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await authHeader(reporter.id),
      payload: {
        targetType: 'review',
        targetId: review.id,
        reason: 'spam',
        body: 'This is promotional spam',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().targetId).toBe(review.id);
    expect(res.json().reason).toBe('spam');
    await app.close();
  });

  it('rejects duplicate open report from same reporter on same target with 409 Conflict', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `dup-${Date.now()}@t.l` });
    const author = await makeUser({ email: `auth-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });

    const r1 = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await authHeader(reporter.id),
      payload: {
        targetType: 'review',
        targetId: review.id,
        reason: 'spam',
      },
    });
    expect(r1.statusCode).toBe(201);

    const r2 = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await authHeader(reporter.id),
      payload: {
        targetType: 'review',
        targetId: review.id,
        reason: 'abuse',
      },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().code).toBe('conflict');
    await app.close();
  });

  it('auto-hides review and updates product tallies on 4th distinct reporter', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ah-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({
      userId: author.id,
      productId: product.id,
      rating: 'buy_again',
      body: 'Some comment',
      status: 'visible',
    });

    // Set initial product tallies
    await getPrisma().product.update({
      where: { id: product.id },
      data: { ratingCount: 1, buyAgainCount: 1, reviewCount: 1 },
    });

    // Submit reports from 4 distinct users
    for (let i = 0; i < 4; i++) {
      const rep = await makeUser({ email: `rep${i}-${Date.now()}@t.l` });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await authHeader(rep.id),
        payload: {
          targetType: 'review',
          targetId: review.id,
          reason: 'abuse',
        },
      });
      expect(res.statusCode).toBe(201);
    }

    const updatedReview = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(updatedReview?.status).toBe('hidden');

    const updatedProduct = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(updatedProduct?.ratingCount).toBe(0);
    expect(updatedProduct?.buyAgainCount).toBe(0);
    expect(updatedProduct?.reviewCount).toBe(0);

    await app.close();
  });
});
