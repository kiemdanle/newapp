import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

describe('GET /v1/deals', () => {
  it('returns visible deals sorted by score DESC', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `a-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `b-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `c-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, score: 0.2 });
    await makeDeal({ userId: u2.id, productId: p.id, score: 0.8 });
    await makeDeal({ userId: u3.id, productId: p.id, score: 0.5 });
    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(3);
    expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
    await app.close();
  });

  it('excludes hidden and deleted deals', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `h1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `h2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `h3-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, status: 'hidden' });
    await makeDeal({ userId: u2.id, productId: p.id, status: 'deleted' });
    await makeDeal({ userId: u3.id, productId: p.id, status: 'visible' });
    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it('supports sort=new', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `n1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `n2-${Date.now()}@t.l` });
    const d1 = await makeDeal({ userId: u1.id, productId: p.id });
    await new Promise((r) => setTimeout(r, 10));
    const d2 = await makeDeal({ userId: u2.id, productId: p.id });
    const res = await app.inject({ method: 'GET', url: '/v1/deals?sort=new' });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toEqual([d2.id, d1.id]);
    await app.close();
  });

  it('returns 400 for invalid sort', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/deals?sort=bogus' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('scopes feed to viewer country — country-A deal absent from country-B viewer', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const poster = await makeUser({ email: `cp-${Date.now()}@t.l`, country: 'US' });
    const viewerB = await makeUser({ email: `cb-${Date.now()}@t.l`, country: 'GB' });
    const dealUs = await makeDeal({ userId: poster.id, productId: p.id, country: 'US' });
    const res = await app.inject({
      method: 'GET', url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerB.id, role: 'user' })}` },
    });
    expect(res.json().items.map((x: { id: string }) => x.id)).not.toContain(dealUs.id);
    const viewerA = await makeUser({ email: `ca-${Date.now()}@t.l`, country: 'US' });
    const resA = await app.inject({
      method: 'GET', url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerA.id, role: 'user' })}` },
    });
    expect(resA.json().items.map((x: { id: string }) => x.id)).toContain(dealUs.id);
    await app.close();
  });

  it('global fallback when viewer has no country', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const poster = await makeUser({ email: `gp-${Date.now()}@t.l`, country: 'US' });
    const viewerNoCountry = await makeUser({ email: `gn-${Date.now()}@t.l`, country: null });
    const dealUs = await makeDeal({ userId: poster.id, productId: p.id, country: 'US' });
    const res = await app.inject({
      method: 'GET', url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerNoCountry.id, role: 'user' })}` },
    });
    expect(res.json().items.map((x: { id: string }) => x.id)).toContain(dealUs.id);
    await app.close();
  });

  it('null-country deals visible to every viewer', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const posterNoCountry = await makeUser({ email: `pn-${Date.now()}@t.l`, country: null });
    const viewerUs = await makeUser({ email: `vu-${Date.now()}@t.l`, country: 'US' });
    const dealNull = await makeDeal({ userId: posterNoCountry.id, productId: p.id, country: null });
    const res = await app.inject({
      method: 'GET', url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerUs.id, role: 'user' })}` },
    });
    expect(res.json().items.map((x: { id: string }) => x.id)).toContain(dealNull.id);
    await app.close();
  });
});
