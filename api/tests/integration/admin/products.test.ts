import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/products', () => {
  it('lists products with status filter', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    await prisma.product.createMany({
      data: [
        { name: 'Milk', source: 'off', status: 'active', barcode: `BC-${Date.now()}-1` },
        { name: 'Bread', source: 'user', status: 'pending', barcode: `BC-${Date.now()}-2` },
      ],
    });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/products?status=pending', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.every((p: { status: string }) => p.status === 'pending')).toBe(true);
    await app.close();
  });
});

describe('GET /v1/admin/products/:id', () => {
  it('returns product by id', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Yogurt', source: 'off', status: 'active' } });
    const res = await app.inject({ method: 'GET', url: `/v1/admin/products/${p.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(p.id);
    await app.close();
  });

  it('404 for missing product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/products/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /v1/admin/products/:id', () => {
  it('updates product and writes audit log', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Old', source: 'user', status: 'active' } });
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { name: 'New', brand: 'Acme' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('New');
    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetId: p.id } });
    expect(log.action).toBe('product.update');
    await app.close();
  });
});

describe('POST /v1/admin/products/:id/merge', () => {
  it('merges losers into winner', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const winner = await prisma.product.create({ data: { name: 'Winner', source: 'off', status: 'active' } });
    const loser = await prisma.product.create({ data: { name: 'Loser', source: 'off', status: 'active' } });
    const u = await makeUserForAdmin();
    await prisma.record.create({
      data: { userId: u.id, productId: loser.id, expiryDate: new Date('2026-12-01'), clientId: `${crypto.randomUUID()}`, notifyAt: [] },
    });
    const res = await app.inject({
      method: 'POST', url: `/v1/admin/products/${winner.id}/merge`, headers,
      payload: { winnerId: winner.id, loserIds: [loser.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().movedRecords).toBe(1);
    const l = await prisma.product.findUniqueOrThrow({ where: { id: loser.id } });
    expect(l.status).toBe('merged_into');
    await app.close();
  });

  it('rejects merging winner into itself', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Self', source: 'off', status: 'active' } });
    const res = await app.inject({ method: 'POST', url: `/v1/admin/products/${p.id}/merge`, headers, payload: { winnerId: p.id, loserIds: [p.id] } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('admin pending product edits', () => {
  it('lists and resolves pending edits', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'Before', source: 'off', status: 'active' } });
    const u = await makeUserForAdmin();
    const edit = await prisma.productEdit.create({ data: { productId: p.id, submittedBy: u.id, proposed: { name: 'After' }, status: 'pending' } });

    const listRes = await app.inject({ method: 'GET', url: '/v1/admin/products/pending', headers });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.length).toBeGreaterThanOrEqual(1);

    const resolveRes = await app.inject({ method: 'PATCH', url: `/v1/admin/products/pending/${edit.id}`, headers, payload: { decision: 'approve' } });
    expect(resolveRes.statusCode).toBe(200);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.name).toBe('After');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'product_edit.resolve' } });
    expect(log).toBeTruthy();
    await app.close();
  });
});
