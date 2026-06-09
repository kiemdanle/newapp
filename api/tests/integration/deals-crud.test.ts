import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function authHeaders(uid: string, idemKey?: string) {
  const h: Record<string, string> = {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}`,
  };
  if (idemKey) h['idempotency-key'] = idemKey;
  return h;
}

describe('POST /v1/deals', () => {
  it('creates a visible deal and stamps country from poster', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true, country: 'US' });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: await authHeaders(user.id, `d-${randomUUID()}`),
      payload: { productId: product.id, price: 3.49, storeName: 'Aldi', note: 'half price' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('visible');
    expect(res.json().price).toBe(3.49);
    expect(res.json().country).toBe('US');
    expect(res.json().currency).toMatch(/^[A-Z]{3}$/);
    await app.close();
  });

  it('rejects unauthenticated with 401', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: { 'idempotency-key': `x-${Date.now()}` },
      payload: { productId: product.id, price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: await authHeaders(user.id),
      payload: { productId: product.id, price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('404 for unknown product', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: await authHeaders(user.id, `d-${randomUUID()}`),
      payload: { productId: '00000000-0000-0000-0000-0000000000ff', price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects negative price', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: await authHeaders(user.id, `d-${randomUUID()}`),
      payload: { productId: product.id, price: -1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects non-CDN photoUrl', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST', url: '/v1/deals',
      headers: await authHeaders(user.id, `d-${randomUUID()}`),
      payload: { productId: product.id, price: 1, storeName: 'X', photoUrl: 'http://evil.com/img.jpg' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /v1/deals/:id', () => {
  it('returns a visible deal with product + author', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `g-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({ method: 'GET', url: `/v1/deals/${deal.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.id).toBe(product.id);
    expect(res.json().author.id).toBe(author.id);
    await app.close();
  });

  it('404 for hidden deal to non-owner', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `gh-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id, status: 'hidden' });
    const res = await app.inject({ method: 'GET', url: `/v1/deals/${deal.id}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /v1/deals/:id', () => {
  it('updates own deal', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id, price: 5, storeName: 'A' });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/deals/${deal.id}`,
      headers: await authHeaders(user.id),
      payload: { price: 2.5, storeName: 'B' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().price).toBe(2.5);
    expect(res.json().storeName).toBe('B');
    await app.close();
  });

  it('403 for another user deal', async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `o-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `i-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: owner.id, productId: product.id });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/deals/${deal.id}`,
      headers: await authHeaders(intruder.id),
      payload: { price: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('DELETE /v1/deals/:id', () => {
  it('soft-deletes own deal', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/deals/${deal.id}`, headers: await authHeaders(user.id) });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('deleted');
    await app.close();
  });

  it('403 for another user deal', async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `do-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `di-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: owner.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/deals/${deal.id}`, headers: await authHeaders(intruder.id) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
