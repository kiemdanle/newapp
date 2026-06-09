import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../../helpers/admin.js';

describe('admin-only plugin', () => {
  it('returns 401 when no bearer is sent', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 when caller is a non-admin user', async () => {
    const app = await buildServer();
    const u = await makeUserForAdmin();
    const { issueAccessToken } = await import('../../../src/services/auth/tokens.js');
    const token = await issueAccessToken({ sub: u.id, role: u.role as 'user' });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('allows admin through', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping', headers });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
