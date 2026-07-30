import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user', tokenVersion: 0 })}` };
}

describe('reporting a product', () => {
  it('auto-hides an active product to report_hidden (never legacy pending) after >3 reports', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    for (let i = 0; i < 4; i++) {
      const reporter = await makeUser({ email: `pr${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'product', targetId: product.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(after?.status).toBe('report_hidden');
    expect(after?.status).not.toBe('pending');
    await app.close();
  });

  it('does NOT auto-hide at exactly 3 reports', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    await getPrisma().product.update({ where: { id: product.id }, data: { status: 'active' } });
    for (let i = 0; i < 3; i++) {
      const reporter = await makeUser({ email: `pr3-${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'product', targetId: product.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(after?.status).toBe('active');
    await app.close();
  });

  it('is a no-op on a product that is already non-active', async () => {
    const app = await buildServer();
    const creator = await makeUser();
    const product = await makeProduct({ createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: product.id }, data: { status: 'pending' } });
    for (let i = 0; i < 4; i++) {
      const reporter = await makeUser({ email: `prn-${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'product', targetId: product.id, reason: 'spam' },
      });
    }
    // A creator-submitted pending row is untouched by auto-hide — it is never
    // reclassified as report_hidden by this path.
    const after = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(after?.status).toBe('pending');
    await app.close();
  });
});

describe('POST /v1/reports against a product target', () => {
  it("non-enumerating 404 for another user's private draft (never a discoverable existence oracle)", async () => {
    const app = await buildServer();
    const owner = await makeUser();
    const reporter = await makeUser();
    const product = await makeProduct({ createdByUserId: owner.id });
    await getPrisma().product.update({ where: { id: product.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'product', targetId: product.id, reason: 'spam' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('report_target_not_found');
    const created = await getPrisma().report.findFirst({ where: { targetId: product.id } });
    expect(created).toBeNull();
    await app.close();
  });

  it('201 for an active product (regression)', async () => {
    const app = await buildServer();
    const reporter = await makeUser();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'product', targetId: product.id, reason: 'spam' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});
