import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/users', () => {
  it('returns paginated users, hides system user, supports filtering', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUserForAdmin({ email: `alice-${Date.now()}@example.com`, country: 'US' });
    await makeUserForAdmin({ email: `bob-${Date.now()}@example.com`, status: 'suspended' });

    const res = await app.inject({ method: 'GET', url: '/v1/admin/users?limit=10', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.find((u: { id: string }) => u.id === '00000000-0000-0000-0000-000000000001')).toBeUndefined();

    const filtered = await app.inject({ method: 'GET', url: '/v1/admin/users?status=suspended', headers });
    expect(filtered.json().items.every((u: { status: string }) => u.status === 'suspended')).toBe(true);
    await app.close();
  });

  it('paginates with cursor', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    for (let i = 0; i < 3; i++) await makeUserForAdmin({ email: `pg-${i}-${Date.now()}@example.com` });
    const p1 = await app.inject({ method: 'GET', url: '/v1/admin/users?limit=2', headers });
    const b1 = p1.json();
    expect(b1.items).toHaveLength(2);
    expect(b1.nextCursor).toBeTruthy();
    const p2 = await app.inject({ method: 'GET', url: `/v1/admin/users?limit=2&cursor=${encodeURIComponent(b1.nextCursor)}`, headers });
    expect(p2.json().items[0].id).not.toBe(b1.items[0].id);
    await app.close();
  });
});

describe('GET /v1/admin/users/:id', () => {
  it('returns full profile with counts', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUserForAdmin();
    const res = await app.inject({ method: 'GET', url: `/v1/admin/users/${u.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(u.id);
    expect(res.json().recordCount).toBe(0);
    await app.close();
  });

  it('404 for missing user', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/users/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /v1/admin/users/:id', () => {
  it('updates fields and writes audit log', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const u = await makeUserForAdmin();
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/users/${u.id}`, headers, payload: { status: 'suspended' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('suspended');
    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetId: u.id } });
    expect(log.action).toBe('user.update');
    await app.close();
  });
});

describe('POST /v1/admin/users/:id/sessions/revoke-all', () => {
  it('revokes all sessions', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUserForAdmin();
    await getPrisma().session.createMany({
      data: [
        { userId: u.id, refreshTokenHash: `h1-${Date.now()}`, expiresAt: new Date(Date.now() + 86400_000) },
        { userId: u.id, refreshTokenHash: `h2-${Date.now()}`, expiresAt: new Date(Date.now() + 86400_000) },
      ],
    });
    const res = await app.inject({ method: 'POST', url: `/v1/admin/users/${u.id}/sessions/revoke-all`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().revoked).toBe(2);
    await app.close();
  });
});

describe('POST /v1/admin/users/:id/impersonate', () => {
  it('returns a short-lived token for the target user', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUserForAdmin();
    const res = await app.inject({ method: 'POST', url: `/v1/admin/users/${u.id}/impersonate`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().expiresIn).toBe(15 * 60);
    await app.close();
  });
});
