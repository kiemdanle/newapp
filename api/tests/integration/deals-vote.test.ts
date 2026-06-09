import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}`,
    'idempotency-key': `vote-${uid}-${randomUUID()}`,
  };
}

describe('POST /v1/deals/:id/vote', () => {
  it('inserts a +1 vote and is idempotent on upsert', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `va-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `vv-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const headers = await h(voter.id);
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers, payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers, payload: { value: 1 } });
    expect(await getPrisma().dealVote.count({ where: { dealId: deal.id } })).toBe(1);
    await app.close();
  });

  it('recomputes counts + Wilson score synchronously', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `sy-${Date.now()}@t.l` });
    const v1 = await makeUser({ email: `sy1-${Date.now()}@t.l` });
    const v2 = await makeUser({ email: `sy2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(v1.id), payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(v2.id), payload: { value: -1 } });
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.upvoteCount).toBe(1);
    expect(after?.downvoteCount).toBe(1);
    expect(Number(after?.score)).toBeGreaterThan(0);
    await app.close();
  });

  it('switches vote from +1 to -1', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `s1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `s2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: -1 } });
    const all = await getPrisma().dealVote.findMany({ where: { dealId: deal.id } });
    expect(all).toHaveLength(1);
    expect(all[0]!.value).toBe(-1);
    await app.close();
  });

  it('refuses voting on own deal with 403', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(user.id), payload: { value: 1 } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('cannot_vote_own_deal');
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ik1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `ik2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({
      method: 'POST', url: `/v1/deals/${deal.id}/vote`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('DELETE /v1/deals/:id/vote', () => {
  it("removes the caller's vote", async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `d1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `d2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    const del = await app.inject({
      method: 'DELETE', url: `/v1/deals/${deal.id}/vote`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
    });
    expect(del.statusCode).toBe(204);
    expect(await getPrisma().dealVote.count({ where: { dealId: deal.id } })).toBe(0);
    await app.close();
  });
});
