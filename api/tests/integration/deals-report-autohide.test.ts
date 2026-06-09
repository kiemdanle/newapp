import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('reporting a deal', () => {
  it('creates an open report for a deal', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ra-${Date.now()}@t.l` });
    const reporter = await makeUser({ email: `rp-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({
      method: 'POST', url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('open');
    await app.close();
  });

  it('auto-hides a deal after >3 reports', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ah-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    for (let i = 0; i < 4; i++) {
      const reporter = await makeUser({ email: `r${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST', url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('hidden');
    await app.close();
  });

  it('does NOT auto-hide at exactly 3 reports', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `t3-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    for (let i = 0; i < 3; i++) {
      const reporter = await makeUser({ email: `t3r${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST', url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('visible');
    await app.close();
  });

  it('404 for unknown targetId', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `r-${Date.now()}@t.l` });
    const res = await app.inject({
      method: 'POST', url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'deal', targetId: '00000000-0000-0000-0000-0000000000ff', reason: 'spam' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
