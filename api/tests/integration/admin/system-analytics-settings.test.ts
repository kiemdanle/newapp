import { describe, expect, it, beforeEach } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

async function seedSettings() {
  const prisma = getPrisma();
  await prisma.setting.upsert({
    where: { key: 'feature_flags' },
    update: { value: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } },
    create: { key: 'feature_flags', value: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } },
  });
  await prisma.setting.upsert({
    where: { key: 'moderation' },
    update: { value: { autoHideReportThreshold: 3, profanitySensitivity: 'medium' } },
    create: { key: 'moderation', value: { autoHideReportThreshold: 3, profanitySensitivity: 'medium' } },
  });
}

describe('admin analytics', () => {
  it('overview returns counts', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUserForAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/overview', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalUsers).toBeGreaterThan(0);
    await app.close();
  });

  it('scans returns daily + bySource', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/scans?range=30d', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().range).toBe('30d');
    expect(Array.isArray(res.json().daily)).toBe(true);
    await app.close();
  });

  it('reviews returns distribution', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/reviews?range=7d', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('buyAgainPct');
    expect(res.json()).toHaveProperty('ratingCount');
    await app.close();
  });

  it('geography returns top countries', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUserForAdmin({ country: 'US' });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/geography', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().top.length).toBeLessThanOrEqual(20);
    await app.close();
  });
});

describe('admin system', () => {
  it('queue-health returns all queues', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/queue-health', headers });
    expect(res.statusCode).toBe(200);
    const names = res.json().queues.map((q: { name: string }) => q.name);
    expect(names).toEqual(expect.arrayContaining(['product-lookup', 'notification-schedule', 'notification-send']));
    await app.close();
  });

  it('external-apis returns breaker state', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/external-apis', headers });
    expect(res.statusCode).toBe(200);
    const names = res.json().breakers.map((b: { name: string }) => b.name);
    expect(names).toEqual(expect.arrayContaining(['off', 'upcitemdb', 'expo-push']));
    await app.close();
  });

  it('api-errors returns aggregated counts', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await getPrisma().apiError.createMany({
      data: [
        { route: '/v1/products/lookup', method: 'POST', status: 500 },
        { route: '/v1/products/lookup', method: 'POST', status: 500 },
      ],
    });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/api-errors?range=24h', headers });
    expect(res.statusCode).toBe(200);
    const row = res.json().rows.find((r: { status: number; route: string }) =>
      r.status === 500 && r.route === '/v1/products/lookup'
    );
    expect(row?.count).toBeGreaterThanOrEqual(2);
    await app.close();
  });

  it('push-logs returns paginated logs', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUserForAdmin();
    await getPrisma().pushLog.create({ data: { userId: u.id, templateKey: 'expiry_7d', status: 'sent' } });
    const res = await app.inject({ method: 'GET', url: `/v1/admin/system/push-logs?userId=${u.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThanOrEqual(1);
    await app.close();
  });
});

describe('admin settings', () => {
  beforeEach(async () => {
    await seedSettings();
  });

  it('GET feature-flags returns current flags', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/feature-flags', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reviewsEnabled: true });
    await app.close();
  });

  it('PATCH feature-flags updates and audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const res = await app.inject({
      method: 'PATCH', url: '/v1/admin/settings/feature-flags', headers,
      payload: { reviewsEnabled: false, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reviewsEnabled).toBe(false);
    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'settings.feature_flags.update' } });
    expect(log).toBeTruthy();
    await app.close();
  });

  it('GET/PATCH moderation settings', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const get = await app.inject({ method: 'GET', url: '/v1/admin/settings/moderation', headers });
    expect(get.statusCode).toBe(200);
    expect(get.json().autoHideReportThreshold).toBe(3);
    const patch = await app.inject({
      method: 'PATCH', url: '/v1/admin/settings/moderation', headers,
      payload: { autoHideReportThreshold: 5, profanitySensitivity: 'high' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().autoHideReportThreshold).toBe(5);
    await app.close();
  });
});
