import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { DEFAULT_PHOTO_LIMITS } from '@expyrico/shared';

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

describe('Admin Photo Limits Settings Routes & Database Position Checks', () => {
  it('GET /v1/admin/settings/photo-limits returns default limits', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/photo-limits',
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.maxProductPhotos).toBe(DEFAULT_PHOTO_LIMITS.maxProductPhotos);
    expect(body.maxPantryItemPhotos).toBe(DEFAULT_PHOTO_LIMITS.maxPantryItemPhotos);

    await app.close();
  });

  it('admin updates photo limits setting, audit log is written, and get reflects update', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);
    const prisma = getPrisma();

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/photo-limits',
      headers: adminHeaders,
      payload: {
        maxProductPhotos: 8,
        maxPantryItemPhotos: 12,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchedBody = patchRes.json();
    expect(patchedBody.maxProductPhotos).toBe(8);
    expect(patchedBody.maxPantryItemPhotos).toBe(12);

    // Verify audit log
    const log = await prisma.adminAuditLog.findFirst({
      where: {
        action: 'settings.photo_limits.update',
        adminId: admin.id,
      },
    });
    expect(log).not.toBeNull();

    // Verify GET reflects update
    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/photo-limits',
      headers: adminHeaders,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().maxProductPhotos).toBe(8);
    expect(getRes.json().maxPantryItemPhotos).toBe(12);

    await app.close();
  });

  it('GET /v1/settings/photo-limits returns current limits for client apps without admin auth', async () => {
    const app = await buildServer();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/settings/photo-limits',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.maxProductPhotos).toBe('number');
    expect(typeof body.maxPantryItemPhotos).toBe('number');

    await app.close();
  });

  it('non-admin is rejected with 403 on photo limits admin routes', async () => {
    const app = await buildServer();
    const user = await makeUser({ role: 'user', emailVerified: true });
    const userHeaders = await userHeadersFor(user.id);

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/photo-limits',
      headers: userHeaders,
    });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/photo-limits',
      headers: userHeaders,
      payload: { maxProductPhotos: 10, maxPantryItemPhotos: 10 },
    });
    expect(patchRes.statusCode).toBe(403);

    await app.close();
  });

  it('rejects update with out-of-range photo limits (< 1 or > 20)', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const zeroRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/photo-limits',
      headers: adminHeaders,
      payload: { maxProductPhotos: 0, maxPantryItemPhotos: 5 },
    });
    expect(zeroRes.statusCode).toBe(400);

    const overRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/photo-limits',
      headers: adminHeaders,
      payload: { maxProductPhotos: 5, maxPantryItemPhotos: 25 },
    });
    expect(overRes.statusCode).toBe(400);

    await app.close();
  });

  it('PostgreSQL allows inserting a 6th photo (position 5) without check constraint violation', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ role: 'user', emailVerified: true });

    const product = await makeProduct({
      name: 'Test 6-Photo Product',
      status: 'draft',
      createdByUserId: user.id,
    });

    // Insert 6 photos (positions 0 through 5)
    for (let pos = 0; pos <= 5; pos++) {
      await prisma.productPhoto.create({
        data: {
          id: randomUUID(),
          productId: product.id,
          position: pos,
          uploadedByUserId: user.id,
          moderationStatus: 'pending',
          mimeType: 'image/webp',
          displayByteSize: 100000,
          displayWidth: 1000,
          displayHeight: 1000,
          thumbnailByteSize: 20000,
          thumbnailWidth: 300,
          thumbnailHeight: 300,
          privateStorageKey: `private/test/${pos}`,
        },
      });
    }

    const count = await prisma.productPhoto.count({ where: { productId: product.id } });
    expect(count).toBe(6);
  });
});
