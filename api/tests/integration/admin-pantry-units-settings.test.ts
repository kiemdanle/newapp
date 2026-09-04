import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function adminHeadersFor(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: adminId, role: 'admin', tokenVersion: 0 })}`,
  };
}

describe('Pantry Units Settings Routes', () => {
  it('GET /v1/settings/pantry-units returns default top 4 units for public/clients', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/settings/pantry-units',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().topUnits).toEqual(['pcs', 'pack', 'can', 'bottle']);
    await app.close();
  });

  it('admin updates top units setting, audit log is written, and client reflects update', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);
    const prisma = getPrisma();

    // 1. Initial admin read
    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/pantry-units',
      headers: adminHeaders,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().topUnits).toEqual(['pcs', 'pack', 'can', 'bottle']);

    // 2. Admin updates top units
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-units',
      headers: adminHeaders,
      payload: {
        topUnits: ['oz', 'lb', 'can', 'pcs'],
      },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().topUnits).toEqual(['oz', 'lb', 'can', 'pcs']);

    // 3. Verify audit log
    const log = await prisma.adminAuditLog.findFirst({
      where: {
        adminId: admin.id,
        action: 'settings.pantry_units.update',
      },
    });
    expect(log).not.toBeNull();

    // 4. Verify client endpoint immediately returns updated top units
    const clientRes = await app.inject({
      method: 'GET',
      url: '/v1/settings/pantry-units',
    });
    expect(clientRes.statusCode).toBe(200);
    expect(clientRes.json().topUnits).toEqual(['oz', 'lb', 'can', 'pcs']);

    await app.close();
  });

  it('rejects update with duplicate units, wrong length, or invalid characters', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    // Duplicate units
    const dupeRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-units',
      headers: adminHeaders,
      payload: {
        topUnits: ['pcs', 'pcs', 'can', 'pack'],
      },
    });
    expect(dupeRes.statusCode).toBe(400);

    // Wrong length (3 instead of 4)
    const lengthRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-units',
      headers: adminHeaders,
      payload: {
        topUnits: ['pcs', 'pack', 'can'],
      },
    });
    expect(lengthRes.statusCode).toBe(400);

    // Invalid character (XSS / control character)
    const xssRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/pantry-units',
      headers: adminHeaders,
      payload: {
        topUnits: ['pcs', 'pack', '<script>', 'can'],
      },
    });
    expect(xssRes.statusCode).toBe(400);

    await app.close();
  });

  it('non-admin is rejected with 403 on admin setting routes', async () => {
    const app = await buildServer();
    const user = await makeUser({ role: 'user' });
    const userHeaders = {
      authorization: `Bearer ${await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: 0 })}`,
    };

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/pantry-units',
      headers: userHeaders,
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
