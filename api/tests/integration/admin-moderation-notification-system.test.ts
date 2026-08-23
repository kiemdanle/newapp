import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { processModerationNotificationTick } from '../../src/services/notifications/moderation-queue.js';

const BASE = '/v1/admin/system/moderation-notifications';

async function seedTemplate() {
  await getPrisma().notificationTemplate.create({
    data: {
      key: 'moderation_queue',
      title: 'Moderation queue needs review',
      body: '{total} item(s): {newProducts} products, {revisions} revisions.',
    },
  });
}

async function seedEvent(kind: 'new_product' | 'product_revision') {
  return getPrisma().moderationNotificationEvent.create({
    data: { kind, sourceId: crypto.randomUUID(), submissionVersion: 2, submittedAt: new Date() },
  });
}

describe('admin moderation notification system endpoints', () => {
  it('returns live pending product/revision counts to an active admin', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await getPrisma().product.create({
      data: { barcode: `summary-${crypto.randomUUID()}`, name: 'Pending product', source: 'user', createdByUserId: creator.id, status: 'pending' },
    });
    await getPrisma().productEdit.create({
      data: { productId: product.id, submittedBy: creator.id, proposed: {}, status: 'pending' },
    });

    const res = await app.inject({ method: 'GET', url: `${BASE}/summary`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ newProducts: 1, revisions: 1, total: 2 });
    expect(admin.role).toBe('admin');
    await app.close();
  });

  it('returns redacted durable batch history and health without recipient PII or token data', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await seedTemplate();
    await seedEvent('new_product');
    await seedEvent('product_revision');
    await processModerationNotificationTick(new Date());

    const [history, health] = await Promise.all([
      app.inject({ method: 'GET', url: BASE, headers }),
      app.inject({ method: 'GET', url: `${BASE}/health`, headers }),
    ]);
    expect(history.statusCode).toBe(200);
    const row = history.json().items[0];
    expect(row).toMatchObject({ newProductCount: 1, revisionCount: 1, recipientCount: 1 });
    expect(JSON.stringify(row)).not.toContain('email');
    expect(JSON.stringify(row)).not.toContain('deviceToken');
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ pendingDeliveries: 0, terminalFailures: 0 });

    const deliveries = await app.inject({ method: 'GET', url: `${BASE}/${row.id}/deliveries`, headers });
    expect(deliveries.statusCode).toBe(200);
    expect(deliveries.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'push', attempts: 1, completedAt: expect.any(String), tokenSummary: expect.objectContaining({ sent: 0, failed: 0, invalid: 0 }) }),
      expect.objectContaining({ channel: 'email', attempts: 1, completedAt: expect.any(String), tokenSummary: null }),
    ]));
    expect(JSON.stringify(deliveries.json())).not.toContain('recipientUserId');
    expect(JSON.stringify(deliveries.json())).not.toContain('deviceToken');
    await app.close();
  });

  it('rejects a pre-demotion admin token after the database role is removed', async () => {
    const app = await buildServer();
    const { admin } = await makeAdmin();
    const staleAdminToken = await issueAccessToken({ sub: admin.id, role: 'admin', tokenVersion: admin.tokenVersion });
    await getPrisma().user.update({ where: { id: admin.id }, data: { role: 'user' } });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/health`,
      headers: { authorization: `Bearer ${staleAdminToken}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects unauthenticated history access', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: BASE });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
