import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function authHeader(uid: string, tokenVersion = 0) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion })}` };
}

describe('GET /v1/reviews/community', () => {
  it('returns visible reviews with comments on active products and projects product data', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ca-${Date.now()}@t.l`, firstName: 'Alice' });
    const product = await makeProduct({ name: 'Organic Almond Milk' });
    const review = await makeReview({
      userId: author.id,
      productId: product.id,
      rating: 'buy_again',
      body: 'Delicious and creamy almond milk!',
      status: 'visible',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reviews/community',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const item = body.items.find((r: { id: string }) => r.id === review.id);
    expect(item).toBeDefined();
    expect(item.body).toBe('Delicious and creamy almond milk!');
    expect(item.author?.firstName).toBe('Alice');
    expect(item.author?.id).toBeUndefined();
    expect(item.userId).toBeUndefined();
    expect(item.isOwnReview).toBe(false);
    expect(item.product).toBeDefined();
    expect(item.product.id).toBe(product.id);
    expect(item.product.name).toBe('Organic Almond Milk');
    await app.close();
  });

  it('filters out reviews with null body and reviews on draft products', async () => {
    const app = await buildServer();
    const u1 = await makeUser({ email: `nb-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `dr-${Date.now()}@t.l` });
    const pActive = await makeProduct();
    const pDraft = await makeProduct();
    await getPrisma().product.update({ where: { id: pDraft.id }, data: { status: 'draft' } });
    const rNoBody = await makeReview({
      userId: u1.id,
      productId: pActive.id,
      rating: 'wont_buy',
      body: null,
      status: 'visible',
    });
    const rDraft = await makeReview({
      userId: u2.id,
      productId: pDraft.id,
      rating: 'buy_again',
      body: 'Draft product review',
      status: 'visible',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reviews/community',
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(rNoBody.id);
    expect(ids).not.toContain(rDraft.id);
    await app.close();
  });

  it('projects isOwnReview=true when viewer is the author', async () => {
    const app = await buildServer();
    const viewer = await makeUser({ email: `viewer-${Date.now()}@t.l` });
    const product = await makeProduct();
    const ownReview = await makeReview({
      userId: viewer.id,
      productId: product.id,
      rating: 'buy_again',
      body: 'My review here',
      status: 'visible',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reviews/community',
      headers: await authHeader(viewer.id),
    });

    expect(res.statusCode).toBe(200);
    const item = res.json().items.find((r: { id: string }) => r.id === ownReview.id);
    expect(item).toBeDefined();
    expect(item.isOwnReview).toBe(true);
    await app.close();
  });

  it('rejects revoked tokens with 401 via optionalAuth', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `revoked-${Date.now()}@t.l` });
    // Issue token with tokenVersion 0, then bump DB tokenVersion to 1
    const headers = await authHeader(user.id, 0);
    await getPrisma().user.update({
      where: { id: user.id },
      data: { tokenVersion: 1 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reviews/community',
      headers,
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /v1/products/:id/my-review', () => {
  it('returns null when caller has not reviewed the product', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `mr1-${Date.now()}@t.l` });
    const product = await makeProduct();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/my-review`,
      headers: await authHeader(user.id),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ review: null });
    await app.close();
  });

  it('returns author review when caller has reviewed the product', async () => {
    const app = await buildServer();
    const user = await makeUser({ email: `mr2-${Date.now()}@t.l` });
    const product = await makeProduct({ name: 'Fresh Apples' });
    const review = await makeReview({
      userId: user.id,
      productId: product.id,
      rating: 'buy_again',
      body: 'Crisp and sweet',
      status: 'visible',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/my-review`,
      headers: await authHeader(user.id),
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.review).toBeDefined();
    expect(data.review.id).toBe(review.id);
    expect(data.review.isOwnReview).toBe(true);
    expect(data.review.product.name).toBe('Fresh Apples');
    await app.close();
  });
});
