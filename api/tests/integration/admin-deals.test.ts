// api/tests/integration/admin-deals.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

async function adminHeaders(adminId: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: adminId, role: 'admin', tokenVersion: 0 })}` };
}

async function userHeaders(userId: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}` };
}

describe('GET /v1/admin/deals', () => {
  it('returns 403 for a non-admin', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/deals',
      headers: await userHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns deals for an admin', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const product = await makeProduct();
    const user = await makeUser({ email: `d-${Date.now()}@t.l` });
    // Create one visible and one hidden deal
    await makeDeal({ userId: user.id, productId: product.id, status: 'visible', storeName: 'StoreA' });
    await makeDeal({ userId: user.id, productId: product.id, status: 'hidden', storeName: 'StoreB' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/deals',
      headers: await adminHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(2);
    await app.close();
  });

  it('filters deals by status', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const product = await makeProduct();
    const user = await makeUser({ email: `f-${Date.now()}@t.l` });
    await makeDeal({ userId: user.id, productId: product.id, status: 'visible', storeName: 'V' });
    await makeDeal({ userId: user.id, productId: product.id, status: 'hidden', storeName: 'H' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/deals?status=hidden',
      headers: await adminHeaders(admin.id),
    });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].status).toBe('hidden');
    await app.close();
  });
});

describe('PATCH /v1/admin/deals/:id/status', () => {
  it('flips a deal from visible to hidden', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const product = await makeProduct();
    const user = await makeUser({ email: `s1-${Date.now()}@t.l` });
    const deal = await makeDeal({ userId: user.id, productId: product.id, status: 'visible' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/deals/${deal.id}/status`,
      headers: await adminHeaders(admin.id),
      payload: { status: 'hidden' },
    });
    expect(res.statusCode).toBe(200);
    const { getPrisma } = await import('../../src/db.js');
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('hidden');
    await app.close();
  });

  it('returns 404 for unknown deal', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/deals/00000000-0000-0000-0000-0000000000ff/status',
      headers: await adminHeaders(admin.id),
      payload: { status: 'hidden' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
