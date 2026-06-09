import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/reports', () => {
  it('lists open reports with target preview', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const reporter = await makeUserForAdmin();
    const offender = await makeUserForAdmin();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const review = await prisma.review.create({ data: { userId: offender.id, productId: p.id, rating: 'wont_buy', body: 'rude', status: 'visible' } });
    await prisma.report.create({ data: { reporterId: reporter.id, targetType: 'review', targetId: review.id, reason: 'abuse', status: 'open' } });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/reports?status=open', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThanOrEqual(1);
    expect(res.json().items[0].targetPreview).toMatchObject({ kind: 'review', body: 'rude' });
    await app.close();
  });
});

describe('PATCH /v1/admin/reports/:id/resolve', () => {
  it('hide action marks review hidden and report resolved', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const reporter = await makeUserForAdmin();
    const offender = await makeUserForAdmin();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const review = await prisma.review.create({ data: { userId: offender.id, productId: p.id, rating: 'wont_buy', status: 'visible' } });
    const report = await prisma.report.create({ data: { reporterId: reporter.id, targetType: 'review', targetId: review.id, reason: 'abuse', status: 'open' } });
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'hide' } });
    expect(res.statusCode).toBe(200);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('hidden');
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('resolved');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'report.resolve' } });
    expect(log).toBeTruthy();
    await app.close();
  });

  it('ban suspends offender', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const reporter = await makeUserForAdmin();
    const offender = await makeUserForAdmin();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const review = await prisma.review.create({ data: { userId: offender.id, productId: p.id, rating: 'wont_buy', status: 'visible' } });
    const report = await prisma.report.create({ data: { reporterId: reporter.id, targetType: 'review', targetId: review.id, reason: 'abuse', status: 'open' } });
    await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'ban' } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: offender.id } })).status).toBe('suspended');
    await app.close();
  });
});
