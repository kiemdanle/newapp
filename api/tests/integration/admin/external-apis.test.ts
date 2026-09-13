import { describe, expect, it, beforeEach } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';
import { issueAccessToken } from '../../../src/services/auth/tokens.js';

describe('admin external-apis routes & RBAC', () => {
  beforeEach(async () => {
    const prisma = getPrisma();
    await prisma.barcodeApiCallLog.deleteMany({});
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/external-apis/stats',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects regular users with 403', async () => {
    const app = await buildServer();
    const user = await makeUserForAdmin();
    const token = await issueAccessToken({
      sub: user.id,
      role: 'user',
      tokenVersion: user.tokenVersion,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/external-apis/stats',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows valid admin to fetch external api stats', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/external-apis/stats?range=24h',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.range).toBe('24h');
    expect(body.summary).toBeDefined();
    expect(body.providers).toBeDefined();
    expect(body.volumeTimeline).toBeInstanceOf(Array);
  });

  it('allows admin to list and inspect request logs', async () => {
    const app = await buildServer();
    const { headers, admin } = await makeAdmin();
    const prisma = getPrisma();

    const created = await prisma.barcodeApiCallLog.create({
      data: {
        provider: 'off',
        barcode: '5449000000996',
        endpoint: 'https://world.openfoodfacts.org/api/v2/product/5449000000996.json',
        status: 'hit',
        httpStatus: 200,
        durationMs: 142,
        requestHeaders: { 'user-agent': 'PantryApp/1.0' },
        responseHeaders: { 'content-type': 'application/json' },
        rawResponsePreview: '{"status":1}',
        userId: admin.id,
      },
    });

    // 1. List requests
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/external-apis/requests?limit=10',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.items.length).toBeGreaterThanOrEqual(1);

    // 2. Inspect request detail
    const detailRes = await app.inject({
      method: 'GET',
      url: `/v1/admin/system/external-apis/requests/${created.id}`,
      headers,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json();
    expect(detailBody.id).toBe(created.id);
    expect(detailBody.barcode).toBe('5449000000996');
    expect(detailBody.requestHeaders).toEqual({ 'user-agent': 'PantryApp/1.0' });

    // 3. 404 on non-existent id
    const missingRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/external-apis/requests/00000000-0000-0000-0000-000000000099',
      headers,
    });
    expect(missingRes.statusCode).toBe(404);
  });

  it('allows admin to patch config and writes an audit log', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/system/external-apis/config',
      headers,
      payload: {
        providers: {
          off: { timeoutMs: 4100 },
        },
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json();
    expect(body.providers.off.timeoutMs).toBe(4100);

    // Verify audit log
    const auditLogs = await prisma.adminAuditLog.findMany({
      where: { action: 'settings.external_barcode_providers.update' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.targetType).toBe('setting');
  });

  it('allows admin to reset provider cooldown or breaker and writes an audit log', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();

    const resetRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/system/external-apis/reset',
      headers,
      payload: {
        provider: 'upcitemdb',
        target: 'all',
      },
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json()).toEqual({ ok: true, provider: 'upcitemdb', target: 'all' });

    // Verify audit log
    const auditLogs = await prisma.adminAuditLog.findMany({
      where: { action: 'external_api.reset' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.targetId).toBe('upcitemdb');
  });
});
