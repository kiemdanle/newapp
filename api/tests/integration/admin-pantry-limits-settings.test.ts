import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { DEFAULT_PANTRY_LIMITS } from '@expyrico/shared';
import { SETTING_KEYS } from '../../src/services/admin/settings.js';

async function adminHeadersFor(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: adminId, role: 'admin', tokenVersion: 0 })}`,
  };
}

async function userHeadersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
  };
}

describe('Admin Pantry Limits Settings Routes & Auditing', () => {
  it('GET /v1/admin/settings/pantry-limits returns default limits', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.defaultUserPantryLimit).toBe(DEFAULT_PANTRY_LIMITS.defaultUserPantryLimit);
    expect(body.tierLimits).toEqual(DEFAULT_PANTRY_LIMITS.tierLimits);

    await app.close();
  });

  it('admin updates pantry limits setting, audit log is written, and get reflects update', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
      payload: {
        defaultUserPantryLimit: 75,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json();
    expect(patchBody.defaultUserPantryLimit).toBe(75);
    expect(patchBody.tierLimits).toEqual(DEFAULT_PANTRY_LIMITS.tierLimits);

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().defaultUserPantryLimit).toBe(75);

    const prisma = getPrisma();
    const auditLog = await prisma.adminAuditLog.findFirst({
      where: {
        action: 'settings.pantry_limits.update',
        targetType: 'setting',
        targetId: SETTING_KEYS.PANTRY_LIMITS,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.adminId).toBe(admin.id);
    const diff = auditLog?.diff as { after?: { defaultUserPantryLimit?: number } } | null;
    expect(diff?.after?.defaultUserPantryLimit).toBe(75);

    await app.close();
  });

  it('GET /v1/settings/pantry-limits returns current limits for client apps without admin auth', async () => {
    const app = await buildServer();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/settings/pantry-limits',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('defaultUserPantryLimit');
    expect(body).toHaveProperty('tierLimits');

    await app.close();
  });

  it('non-admin is rejected with 403 on pantry limits admin routes', async () => {
    const app = await buildServer();
    const user = await makeUser({ role: 'user', emailVerified: true });
    const userHeaders = await userHeadersFor(user.id);

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/pantry-limits',
      headers: userHeaders,
    });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-limits',
      headers: userHeaders,
      payload: { defaultUserPantryLimit: 100 },
    });
    expect(patchRes.statusCode).toBe(403);

    await app.close();
  });

  it('rejects update with out-of-range pantry limits (< 1 or > 10000)', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const resZero = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
      payload: { defaultUserPantryLimit: 0 },
    });
    expect(resZero.statusCode).toBe(400);

    const resHuge = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
      payload: { defaultUserPantryLimit: 10001 },
    });
    expect(resHuge.statusCode).toBe(400);

    const resEmpty = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-limits',
      headers: adminHeaders,
      payload: {},
    });
    expect(resEmpty.statusCode).toBe(400);

    await app.close();
  });
});
