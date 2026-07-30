import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct, makeHousehold, makeMembership, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { randomUUID } from 'node:crypto';

async function authHeaders(u: { id: string; role: 'user' | 'admin' }) {
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() };
}

async function statusProduct(status: 'draft' | 'pending' | 'changes_required' | 'active' | 'report_hidden', creatorId?: string) {
  const p = await makeProduct(creatorId ? { createdByUserId: creatorId } : {});
  await getPrisma().product.update({ where: { id: p.id }, data: { status } });
  return p;
}

describe('POST /v1/records — product-use authorization', () => {
  it('rejects a personal record referencing a draft product, even for its creator', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('draft', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(creator),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("allows the creator's own pending product for a new personal record", async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(creator),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('rejects a brand-new personal record referencing a changes_required product', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('changes_required', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(creator),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects a household record referencing the creator\'s own pending product', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const household = await makeHousehold(creator.id);
    const p = await statusProduct('pending', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(creator),
      payload: {
        clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs',
        householdId: household.id,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("another user cannot attach the creator's private product (non-enumerating 404)", async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(other),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('allows an active product for any authenticated user', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('active');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(someone),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('rejects a report_hidden product for anyone (non-enumerating)', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('report_hidden');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: await authHeaders(someone),
      payload: { clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /v1/records/:id — scope-transition authorization', () => {
  it('a changes_required product reference may remain while the record stays personal', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${record.id}`,
      headers: await authHeaders(creator),
      payload: { notes: 'still tracking this one' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('cannot move a changes_required-product personal record into a household merely by membership', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const household = await makeHousehold(creator.id);
    const p = await statusProduct('pending', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${record.id}`,
      headers: await authHeaders(creator),
      payload: { householdId: household.id },
    });
    expect(res.statusCode).toBe(403);
    const unchanged = await getPrisma().record.findUniqueOrThrow({ where: { id: record.id } });
    expect(unchanged.householdId).toBeNull();
    await app.close();
  });

  it('household -> household move of a changes_required-product record is rejected too', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const householdA = await makeHousehold(creator.id);
    const householdB = await makeHousehold(creator.id);
    const p = await statusProduct('pending', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id, householdId: householdA.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${record.id}`,
      headers: await authHeaders(creator),
      payload: { householdId: householdB.id },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('moving a household record with a changes_required product back to personal is allowed (preserved reference)', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const household = await makeHousehold(creator.id);
    const p = await statusProduct('pending', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id, householdId: household.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${record.id}`,
      headers: await authHeaders(creator),
      payload: { householdId: null },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('POST /v1/records/:id/duplicate — product-use authorization', () => {
  it("duplicating an eligible creator-owned changes_required-product record preserves personal scope", async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/records/${record.id}/duplicate`,
      headers: await authHeaders(creator),
      payload: { expiryDate: '2099-02-01' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('cannot duplicate a record referencing a draft product', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('active', creator.id);
    const record = await makeRecord(creator.id, { productId: p.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/records/${record.id}/duplicate`,
      headers: await authHeaders(creator),
      payload: { expiryDate: '2099-02-01' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('POST /v1/records/sync — offline batch product-use authorization', () => {
  it('rejects a personal upsert that newly attaches a draft product', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('draft', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers: await authHeaders(creator),
      payload: {
        upserts: [{
          clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01',
          quantity: 1, unit: 'pcs', updatedAt: new Date().toISOString(),
        }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().changes).toEqual([]);
    const row = await getPrisma().record.findFirst({ where: { userId: creator.id } });
    expect(row).toBeNull();
    await app.close();
  });

  it('allows a personal upsert attaching the creator\'s own pending product', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers: await authHeaders(creator),
      payload: {
        upserts: [{
          clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01',
          quantity: 1, unit: 'pcs', updatedAt: new Date().toISOString(),
        }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().changes.length).toBe(1);
    await app.close();
  });

  it('rejects a household upsert attaching a draft product even for the creator', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const household = await makeHousehold(creator.id);
    const p = await statusProduct('draft', creator.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers: await authHeaders(creator),
      payload: {
        upserts: [{
          clientId: randomUUID(), productId: p.id, expiryDate: '2099-01-01',
          quantity: 1, unit: 'pcs', householdId: household.id, updatedAt: new Date().toISOString(),
        }],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const row = await getPrisma().record.findFirst({ where: { householdId: household.id } });
    expect(row).toBeNull();
    await app.close();
  });
});

describe('reviews/deals/giveaways require an active product', () => {
  it('review creation rejects a non-active product', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('draft', someone.id);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${p.id}/reviews`,
      headers: await authHeaders(someone),
      payload: { rating: 'buy_again' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('deal creation rejects a non-active product', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('pending', someone.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: await authHeaders(someone),
      payload: { productId: p.id, price: 1.99, storeName: 'Corner Mart' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('giveaway creation rejects a non-active product', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('changes_required', someone.id);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/giveaways',
      headers: await authHeaders(someone),
      payload: { title: 'Free stuff', locationText: 'Downtown', productId: p.id },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('giveaway creation allows an active product', async () => {
    const app = await buildServer();
    const someone = await makeUser({ emailVerified: true });
    const p = await statusProduct('active');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/giveaways',
      headers: await authHeaders(someone),
      payload: { title: 'Free stuff', locationText: 'Downtown', productId: p.id },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});
