import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeProduct, makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { putSetting, SETTING_KEYS } from '../../src/services/admin/settings.js';
import {
  contributorLevelsSettingSchema,
  DEFAULT_CONTRIBUTOR_LEVELS,
} from '@expyrico/shared';

async function authHeaders(userId: string, role: 'user' | 'admin' = 'user') {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role, tokenVersion: 0 })}`,
  };
}

describe('User Contributions & Template Dismissal API', () => {
  it('GET /v1/me/contributions returns Level 0 (Unranked) for a new user', async () => {
    const app = await buildServer();
    const user = await makeUser();
    const headers = await authHeaders(user.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });
    if (res.statusCode !== 200) {
      console.error('CONTRIBUTIONS ERROR:', res.body);
    }
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.levels).toHaveLength(10);
    expect(body.progression.currentLevel).toBe(0);
    expect(body.progression.title).toBe('New Explorer');
    expect(body.progression.totalPoints).toBe(0);
    expect(body.progression.nextLevel).toBe(1);
    expect(body.progression.pointsToNextLevel).toBe(10);
    expect(body.items).toEqual([]);

    await app.close();
  });

  it('computes Level 1 for a user with an active catalog product', async () => {
    const app = await buildServer();
    const user = await makeUser();
    const headers = await authHeaders(user.id);

    // Create an active product contributed by this user
    await makeProduct({
      createdByUserId: user.id,
      status: 'active',
      name: 'Organic Oat Milk',
      barcode: '1234567890123',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.progression.currentLevel).toBe(1);
    expect(body.progression.title).toBe('Novice Scout');
    // 10 pts for active product + 10 bonus pts for approval = 20 pts
    expect(body.progression.totalPoints).toBe(20);
    expect(body.progression.nextLevel).toBe(2);
    expect(body.stats.activeApproved).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('Organic Oat Milk');

    await app.close();
  });

  it('honors admin enabled=false toggle on /v1/me/contributions', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin' });
    const user = await makeUser();
    const headers = await authHeaders(user.id);

    // Disable contributor levels via admin setting
    await putSetting(
      SETTING_KEYS.CONTRIBUTOR_LEVELS,
      { enabled: false, levels: [...DEFAULT_CONTRIBUTOR_LEVELS] },
      contributorLevelsSettingSchema,
      admin.id,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);

    // Restore to enabled for other tests
    await putSetting(
      SETTING_KEYS.CONTRIBUTOR_LEVELS,
      { enabled: true, levels: [...DEFAULT_CONTRIBUTOR_LEVELS] },
      contributorLevelsSettingSchema,
      admin.id,
    );

    await app.close();
  });

  it('hard-deletes unsubmitted draft and recalculates level', async () => {
    const app = await buildServer();
    const user = await makeUser();
    const headers = await authHeaders(user.id);
    const prisma = getPrisma();

    // Create a private draft product
    const draft = await makeProduct({
      createdByUserId: user.id,
      status: 'draft',
      name: 'Unsubmitted Cereal Draft',
      barcode: '9876543210987',
    });

    // Verify private unsubmitted draft does NOT appear in community contributions history
    const draftHistoryRes = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });
    expect(draftHistoryRes.json().items).toHaveLength(0);
    expect(draftHistoryRes.json().stats.totalContributed).toBe(0);

    // Discard draft
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/products/drafts/${draft.id}`,
      headers,
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json()).toEqual({ success: true, id: draft.id });
    // Verify row was completely deleted from DB
    const inDb = await prisma.product.findUnique({ where: { id: draft.id } });
    expect(inDb).toBeNull();

    await app.close();
  });

  it('dismisses active product from templates without deleting public catalog row and dynamically reduces level', async () => {
    const app = await buildServer();
    const user = await makeUser();
    const headers = await authHeaders(user.id);
    const prisma = getPrisma();

    // Create an active product
    const product = await makeProduct({
      createdByUserId: user.id,
      status: 'active',
      name: 'Artisan Sourdough Bread',
      barcode: '4444555566667',
    });

    // 1. Initial contributions check: Level 1 (20 pts)
    const beforeRes = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });
    expect(beforeRes.json().progression.currentLevel).toBe(1);
    expect(beforeRes.json().progression.totalPoints).toBe(20);

    // 2. Discard / dismiss active product template
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/products/drafts/${product.id}`,
      headers,
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json()).toEqual({ success: true, id: product.id });

    // 3. Verify public catalog product STILL EXISTS in DB with isDismissedFromTemplates=true
    const inDb = await prisma.product.findUnique({ where: { id: product.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.status).toBe('active');
    expect(inDb?.isDismissedFromTemplates).toBe(true);

    // 4. Verify product no longer appears in templates list
    const draftsRes = await app.inject({
      method: 'GET',
      url: '/v1/products/drafts',
      headers,
    });
    expect(draftsRes.statusCode).toBe(200);
    const foundInDrafts = draftsRes.json().items.some((item: { id: string }) => item.id === product.id);
    expect(foundInDrafts).toBe(false);

    // 5. Verify dynamic XP recalculation: user drops back to Level 0 (0 pts)
    const afterRes = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers,
    });
    expect(afterRes.json().progression.currentLevel).toBe(0);
    expect(afterRes.json().progression.totalPoints).toBe(0);

    // 6. But product still visible in full community contribution history, and activeApproved count is preserved!
    expect(afterRes.json().items).toHaveLength(1);
    expect(afterRes.json().items[0].name).toBe('Artisan Sourdough Bread');
    expect(afterRes.json().stats.activeApproved).toBe(1);
    await app.close();
  });

  it('guarantees cross-user XP isolation when Creator A dismisses a template', async () => {
    const app = await buildServer();
    const userA = await makeUser();
    const userB = await makeUser();
    const headersA = await authHeaders(userA.id);
    const headersB = await authHeaders(userB.id);
    const prisma = getPrisma();

    // User A creates product P
    const productP = await makeProduct({
      createdByUserId: userA.id,
      status: 'active',
      name: 'Shared Community Pasta',
      barcode: '7777888899990',
    });

    // User B uploads a photo for product P
    await prisma.productPhoto.create({
      data: {
        productId: productP.id,
        position: 0,
        uploadedByUserId: userB.id,
        moderationStatus: 'approved',
        publicStorageKey: 'products/photo-user-b.webp',
        mimeType: 'image/webp',
        displayByteSize: 1000,
        displayWidth: 800,
        displayHeight: 600,
        thumbnailByteSize: 200,
        thumbnailWidth: 200,
        thumbnailHeight: 150,
      },
    });
    // User B also submits an approved edit on product P (+5 pts)
    await prisma.productEdit.create({
      data: {
        productId: productP.id,
        submittedBy: userB.id,
        status: 'approved',
        proposed: { brand: 'Authentic Brand' },
      },
    });

    // User B has 10 points total (5 from photo + 5 from approved edit)
    const userBBefore = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers: headersB,
    });
    expect(userBBefore.json().progression.totalPoints).toBe(10);

    // User A dismisses product P from templates
    await app.inject({
      method: 'DELETE',
      url: `/v1/products/drafts/${productP.id}`,
      headers: headersA,
    });

    // User A's points dropped to 0
    const userAAfter = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers: headersA,
    });
    expect(userAAfter.json().progression.totalPoints).toBe(0);

    // User B STILL has their 10 points (photo + edit)! (Cross-user XP isolation)
    const userBAfter = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions',
      headers: headersB,
    });
    expect(userBAfter.json().progression.totalPoints).toBe(10);

    await app.close();
  });

  it('supports bounded multi-page pagination and server-side search across >100 products', async () => {
    const app = await buildServer();
    const user = await makeUser();
    const headers = await authHeaders(user.id);
    const prisma = getPrisma();

    // Batch create 105 active products
    const productsData = Array.from({ length: 105 }, (_, i) => ({
      name: i === 102 ? 'Special Vintage Tea' : `Product Number ${i + 1}`,
      barcode: `99900000${String(i).padStart(4, '0')}`,
      status: 'active' as const,
      createdByUserId: user.id,
      source: 'user' as const,
    }));
    await prisma.product.createMany({ data: productsData });

    // 1. Page 1: limit 50, offset 0
    const page1Res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions?limit=50&offset=0',
      headers,
    });
    expect(page1Res.statusCode).toBe(200);
    const p1 = page1Res.json();
    expect(p1.items).toHaveLength(50);
    expect(p1.stats.totalContributed).toBe(105);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextOffset).toBe(50);

    // 2. Page 2: limit 50, offset 50
    const page2Res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions?limit=50&offset=50',
      headers,
    });
    expect(page2Res.statusCode).toBe(200);
    const p2 = page2Res.json();
    expect(p2.items).toHaveLength(50);
    expect(p2.hasMore).toBe(true);
    expect(p2.nextOffset).toBe(100);

    // 3. Page 3: limit 50, offset 100 -> remaining 5 products
    const page3Res = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions?limit=50&offset=100',
      headers,
    });
    expect(page3Res.statusCode).toBe(200);
    const p3 = page3Res.json();
    expect(p3.items).toHaveLength(5);
    expect(p3.hasMore).toBe(false);
    expect(p3.nextOffset).toBeNull();

    // 4. Server-side search for item created at the far end of the list
    const searchRes = await app.inject({
      method: 'GET',
      url: '/v1/me/contributions?q=Special+Vintage+Tea',
      headers,
    });
    expect(searchRes.statusCode).toBe(200);
    const sBody = searchRes.json();
    expect(sBody.items).toHaveLength(1);
    expect(sBody.items[0].name).toBe('Special Vintage Tea');

    await app.close();
  });
});
