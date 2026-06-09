import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/reviews', () => {
  it('filters by status', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'X', source: 'off', status: 'active' } });
    const u = await makeUserForAdmin();
    const u2 = await makeUserForAdmin();
    await prisma.review.create({ data: { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' } });
    await prisma.review.create({ data: { userId: u2.id, productId: p.id, rating: 'wont_buy', status: 'hidden' } });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/reviews?status=hidden', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.every((r: { status: string }) => r.status === 'hidden')).toBe(true);
    await app.close();
  });
});

describe('GET /v1/admin/reviews/:id', () => {
  it('returns review by id', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const u = await makeUserForAdmin();
    const r = await prisma.review.create({ data: { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' } });
    const res = await app.inject({ method: 'GET', url: `/v1/admin/reviews/${r.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(r.id);
    await app.close();
  });

  it('404 for missing review', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/reviews/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /v1/admin/reviews/:id/status', () => {
  it('hides a review and audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const u = await makeUserForAdmin();
    const r = await prisma.review.create({ data: { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' } });
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/reviews/${r.id}/status`, headers, payload: { status: 'hidden' } });
    expect(res.statusCode).toBe(200);
    const updated = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    expect(updated.status).toBe('hidden');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'review.status' } });
    expect(log.diff).toMatchObject({ before: { status: 'visible' }, after: { status: 'hidden' } });
    await app.close();
  });
});
