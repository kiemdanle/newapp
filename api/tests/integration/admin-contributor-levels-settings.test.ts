import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { DEFAULT_CONTRIBUTOR_LEVELS } from '@expyrico/shared';

async function adminHeadersFor(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: adminId, role: 'admin', tokenVersion: 0 })}`,
  };
}

describe('Admin Contributor Levels Settings Routes', () => {
  it('GET /v1/admin/settings/contributor-levels returns default 10 levels and enabled true', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(true);
    expect(body.levels).toHaveLength(10);
    expect(body.levels[0].level).toBe(1);
    expect(body.levels[0].title).toBe('Novice Scout');
    expect(body.levels[9].level).toBe(10);
    expect(body.levels[9].title).toBe('Expyrico Champion');

    await app.close();
  });

  it('admin updates contributor levels setting, audit log is written, and get reflects update', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);
    const prisma = getPrisma();

    // Prepare updated levels
    const updatedLevels = JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS));
    updatedLevels[0].title = 'Community Novice';
    updatedLevels[0].minPoints = 15;
    // Keep strictly ascending
    for (let i = 1; i < updatedLevels.length; i++) {
      updatedLevels[i].minPoints = updatedLevels[i - 1].minPoints + 50;
    }

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
      payload: {
        enabled: false,
        levels: updatedLevels,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchedBody = patchRes.json();
    expect(patchedBody.enabled).toBe(false);
    expect(patchedBody.levels[0].title).toBe('Community Novice');
    expect(patchedBody.levels[0].minPoints).toBe(15);

    // Verify audit log
    const log = await prisma.adminAuditLog.findFirst({
      where: {
        action: 'settings.contributor_levels.update',
        adminId: admin.id,
      },
    });
    expect(log).not.toBeNull();

    // Verify GET reflects update
    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().enabled).toBe(false);
    expect(getRes.json().levels[0].title).toBe('Community Novice');

    await app.close();
  });

  it('rejects update with non-monotonic points, invalid colorToken, or wrong tier count', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminHeaders = await adminHeadersFor(admin.id);

    // 1. Non-monotonic points (Level 2 <= Level 1)
    const brokenPoints = JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS));
    brokenPoints[1].minPoints = brokenPoints[0].minPoints;

    const res1 = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
      payload: { enabled: true, levels: brokenPoints },
    });
    expect(res1.statusCode).toBe(400);

    // 2. Off-palette color token
    const brokenColor = JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS));
    brokenColor[0].colorToken = 'cyberpunk_neon_yellow';

    const res2 = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
      payload: { enabled: true, levels: brokenColor },
    });
    expect(res2.statusCode).toBe(400);

    // 3. Wrong tier count (9 instead of 10)
    const res3 = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/contributor-levels',
      headers: adminHeaders,
      payload: { enabled: true, levels: DEFAULT_CONTRIBUTOR_LEVELS.slice(0, 9) },
    });
    expect(res3.statusCode).toBe(400);

    await app.close();
  });

  it('non-admin is rejected with 403 on contributor levels admin routes', async () => {
    const app = await buildServer();
    const user = await makeUser({ role: 'user' });
    const userHeaders = {
      authorization: `Bearer ${await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: 0 })}`,
    };

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/contributor-levels',
      headers: userHeaders,
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
