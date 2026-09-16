import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeRecord, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function adminHeaders(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({
      sub: adminId,
      role: 'admin',
      tokenVersion: 0,
    })}`,
  };
}

async function userHeaders(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({
      sub: userId,
      role: 'user',
      tokenVersion: 0,
    })}`,
  };
}

describe('Admin Pantry Items API', () => {
  it('GET /v1/admin/pantry-items returns 403 for non-admin and 401 for unauthenticated', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });

    const unauth = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items',
    });
    expect(unauth.statusCode).toBe(401);

    const nonAdmin = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items',
      headers: await userHeaders(user.id),
    });
    expect(nonAdmin.statusCode).toBe(403);

    await app.close();
  });

  it('GET /v1/admin/pantry-items lists items with search, filter, sort, and pagination', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const userA = await makeUser({ email: `user-a-${Date.now()}@test.local`, firstName: 'Alice' });
    const userB = await makeUser({ email: `user-b-${Date.now()}@test.local`, firstName: 'Bob' });

    const prod = await makeProduct({ name: 'Organic Almond Milk', brand: 'Silk' });

    const r1 = await makeRecord(userA.id, {
      customName: 'Crispy Crackers',
      brand: 'Ritz',
      category: 'Snacks',
      location: 'Pantry Shelf',
      quantity: 3,
      status: 'active',
      expiryDate: new Date('2026-10-01'),
    });

    const r2 = await makeRecord(userB.id, {
      productId: prod.id,
      location: 'Fridge',
      quantity: 1,
      status: 'active',
      expiryDate: new Date('2026-09-25'),
    });

    const r3 = await makeRecord(userA.id, {
      customName: 'Old Apples',
      location: 'Counter',
      status: 'expired',
      expiryDate: new Date('2026-09-01'),
    });

    // 1. Basic list
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items',
      headers: await adminHeaders(admin.id),
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.items.length).toBeGreaterThanOrEqual(3);
    expect(listBody.total).toBeGreaterThanOrEqual(3);

    // 2. Keyword Search (matches 'Crackers')
    const searchRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items?q=Crackers',
      headers: await adminHeaders(admin.id),
    });
    expect(searchRes.statusCode).toBe(200);
    const searchItems = searchRes.json().items;
    expect(searchItems.some((i: { id: string }) => i.id === r1.id)).toBe(true);
    expect(searchItems.some((i: { id: string }) => i.id === r2.id)).toBe(false);

    // 3. Location filter ('Fridge')
    const locRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items?location=Fridge',
      headers: await adminHeaders(admin.id),
    });
    expect(locRes.statusCode).toBe(200);
    const locItems = locRes.json().items;
    expect(locItems.every((i: { location: string | null }) => i.location?.toLowerCase() === 'fridge')).toBe(true);

    // 4. Status filter ('expired')
    const expRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items?status=expired',
      headers: await adminHeaders(admin.id),
    });
    expect(expRes.statusCode).toBe(200);
    const expItems = expRes.json().items;
    expect(expItems.some((i: { id: string }) => i.id === r3.id)).toBe(true);

    // 5. Pagination with limit=1
    const pagRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items?limit=1&page=1',
      headers: await adminHeaders(admin.id),
    });
    expect(pagRes.statusCode).toBe(200);
    const pagBody = pagRes.json();
    expect(pagBody.items).toHaveLength(1);
    expect(pagBody.totalPages).toBeGreaterThanOrEqual(3);

    await app.close();
  });

  it('GET /v1/admin/pantry-items/filter-options returns aggregated categories and locations', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const user = await makeUser({ email: `fo-${Date.now()}@test.local` });

    await makeRecord(user.id, {
      location: 'Cellar',
      category: 'Canned Goods',
      brand: 'Campbell',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/pantry-items/filter-options',
      headers: await adminHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locations).toContain('Cellar');
    expect(body.categories).toContain('Canned Goods');
    expect(body.brands).toContain('Campbell');

    await app.close();
  });

  it('GET, PATCH, and DELETE /v1/admin/pantry-items/:id manages lifecycle with atomic audits and tombstones', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const user = await makeUser({ email: `crud-${Date.now()}@test.local` });
    const prisma = getPrisma();

    const record = await makeRecord(user.id, {
      customName: 'Yogurt Cup',
      brand: 'Chobani',
      quantity: 2,
      location: 'Fridge',
      status: 'active',
      expiryDate: new Date('2026-10-15'),
    });

    // 1. GET /:id
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().displayName).toBe('Yogurt Cup');
    expect(getRes.json().user.email).toBe(user.email);

    // 2. PATCH /:id (Update details)
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
      payload: {
        customName: 'Greek Yogurt Cup',
        location: 'Bottom Shelf',
        quantity: 3,
      },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().customName).toBe('Greek Yogurt Cup');
    expect(patchRes.json().location).toBe('Bottom Shelf');
    expect(patchRes.json().quantity).toBe(3);

    // Verify audit log for patch
    const patchAudit = await prisma.adminAuditLog.findFirst({
      where: {
        targetId: record.id,
        action: 'pantry_item.update',
      },
    });
    expect(patchAudit).not.toBeNull();
    expect(patchAudit?.adminId).toBe(admin.id);

    // 3. PATCH /:id (Soft discard)
    const discardRes = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
      payload: {
        status: 'discarded',
        discardReason: 'Spoiled milk scent',
      },
    });
    expect(discardRes.statusCode).toBe(200);
    expect(discardRes.json().status).toBe('discarded');
    expect(discardRes.json().discardReason).toBe('Spoiled milk scent');
    expect(discardRes.json().discardedAt).not.toBeNull();

    // 4. DELETE /:id (Permanent hard delete)
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
    });
    expect(delRes.statusCode).toBe(204);

    // Verify record is gone from records table
    const deletedRow = await prisma.record.findUnique({ where: { id: record.id } });
    expect(deletedRow).toBeNull();

    // Verify durable tombstone was created with clientId
    const tombstone = await prisma.recordTombstone.findUnique({
      where: { clientId: record.clientId },
    });
    expect(tombstone).not.toBeNull();
    expect(tombstone?.recordId).toBe(record.id);
    expect(tombstone?.userId).toBe(user.id);

    // Verify atomic delete audit log
    const delAudit = await prisma.adminAuditLog.findFirst({
      where: {
        targetId: record.id,
        action: 'pantry_item.delete',
      },
    });
    expect(delAudit).not.toBeNull();
    expect(delAudit?.adminId).toBe(admin.id);

    // 5. Verify POST /records prevents resurrection of tombstoned clientId
    const recreateRes = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: {
        ...(await userHeaders(user.id)),
        'idempotency-key': randomUUID(),
      },
      payload: {
        clientId: record.clientId,
        customName: 'Zombie Yogurt',
        expiryDate: '2026-12-01',
      },
    });
    expect(recreateRes.statusCode).toBe(409);

    await app.close();
  });
});
