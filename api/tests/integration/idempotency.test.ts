import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getRedis } from '../../src/redis.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { buildIdempotencyKey } from '../../src/plugins/idempotency.js';

// Matches hashRequest's stableStringify({ body, query }) shape for a request
// with no payload and no query string (Fastify parses an absent querystring
// as `{}`, not null/undefined).
function noPayloadNoQueryHash(): string {
  return createHash('sha256').update('{"body":null,"query":{}}').digest('hex');
}

async function authedUser() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'abc-123' } };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('idempotency plugin', () => {
  it('replays the cached response for the same actor/body/key', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/test-idem',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.status(201).send({ count: calls });
      },
    );
    const { headers } = await authedUser();
    const r1 = await app.inject({ method: 'POST', url: '/test-idem', headers, payload: { a: 1 } });
    const r2 = await app.inject({ method: 'POST', url: '/test-idem', headers, payload: { a: 1 } });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.body).toBe(r2.body);
    expect(calls).toBe(1);
    await app.close();
  });

  it('400 when Idempotency-Key is missing on a required route', async () => {
    const app = await buildServer();
    app.post('/test-idem-required', { config: { idempotent: 'required' } }, async (_req, reply) =>
      reply.send({ ok: true }),
    );
    const res = await app.inject({ method: 'POST', url: '/test-idem-required' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });

  it('different keys do not collide', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/x',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.send({ calls });
      },
    );
    const { headers } = await authedUser();
    await app.inject({ method: 'POST', url: '/x', headers: { ...headers, 'idempotency-key': 'a' } });
    await app.inject({ method: 'POST', url: '/x', headers: { ...headers, 'idempotency-key': 'b' } });
    expect(calls).toBe(2);
    await app.close();
  });

  it('same actor, different body on the same key -> 409 idempotency_key_reused', async () => {
    const app = await buildServer();
    app.post(
      '/x',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => reply.send({}),
    );
    const { headers } = await authedUser();
    const r1 = await app.inject({ method: 'POST', url: '/x', headers, payload: { a: 1 } });
    const r2 = await app.inject({ method: 'POST', url: '/x', headers, payload: { a: 2 } });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(409);
    expect(r2.json().code).toBe('idempotency_key_reused');
    await app.close();
  });

  it('cross-user same key is isolated (each user executes independently)', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/x',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.send({ calls });
      },
    );
    const a = await authedUser();
    const b = await authedUser();
    const sameKey = { 'idempotency-key': 'shared-key' };
    const r1 = await app.inject({ method: 'POST', url: '/x', headers: { ...a.headers, ...sameKey }, payload: { a: 1 } });
    const r2 = await app.inject({ method: 'POST', url: '/x', headers: { ...b.headers, ...sameKey }, payload: { a: 1 } });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(calls).toBe(2);
    await app.close();
  });

  it('simultaneous requests with the same key execute the handler exactly once', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/slow',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        await sleep(150);
        return reply.status(201).send({ count: calls });
      },
    );
    const { headers } = await authedUser();
    const [r1, r2] = await Promise.all([
      app.inject({ method: 'POST', url: '/slow', headers, payload: { a: 1 } }),
      app.inject({ method: 'POST', url: '/slow', headers, payload: { a: 1 } }),
    ]);
    expect(calls).toBe(1);
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.body).toBe(r2.body);
    await app.close();
  });

  it('does not cache a 5xx response, so a retry re-executes', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/boom',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.status(500).send({ code: 'internal_error' });
      },
    );
    const { headers } = await authedUser();
    const r1 = await app.inject({ method: 'POST', url: '/boom', headers, payload: { a: 1 } });
    const r2 = await app.inject({ method: 'POST', url: '/boom', headers, payload: { a: 1 } });
    expect(r1.statusCode).toBe(500);
    expect(r2.statusCode).toBe(500);
    expect(calls).toBe(2);
    await app.close();
  });

  it('an unauthenticated request is never cached (no actor to bind to)', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post('/anon', { config: { idempotent: true } }, async (_req, reply) => {
      calls += 1;
      return reply.send({ calls });
    });
    const headers = { 'idempotency-key': 'no-auth' };
    await app.inject({ method: 'POST', url: '/anon', headers, payload: {} });
    await app.inject({ method: 'POST', url: '/anon', headers, payload: {} });
    expect(calls).toBe(2);
    await app.close();
  });

  it('an abandoned in-flight reservation (TTL expiry) lets a fresh retry succeed', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/recovered',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.status(201).send({ calls });
      },
    );
    const { user, headers } = await authedUser();
    const key = buildIdempotencyKey(user.id, 'POST', '/recovered', 'abc-123');
    // Simulate a reservation left behind by a crashed worker: state in_flight,
    // matching hash, but with a very short TTL so it vacates almost immediately —
    // well within the plugin's bounded wait window.
    const requestHash = noPayloadNoQueryHash();
    await getRedis().set(key, JSON.stringify({ state: 'in_flight', requestHash }), 'PX', 200);
    const res = await app.inject({ method: 'POST', url: '/recovered', headers });
    expect(res.statusCode).toBe(201);
    expect(calls).toBe(1);
    await app.close();
  });

  it('a still in-flight reservation past the wait bound returns a retryable 409', async () => {
    const app = await buildServer();
    app.post(
      '/stuck',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => reply.status(201).send({}),
    );
    const { user, headers } = await authedUser();
    const key = buildIdempotencyKey(user.id, 'POST', '/stuck', 'abc-123');
    const requestHash = noPayloadNoQueryHash();
    // Long-lived reservation that never completes within the wait bound.
    await getRedis().set(key, JSON.stringify({ state: 'in_flight', requestHash }), 'EX', 30);
    const res = await app.inject({ method: 'POST', url: '/stuck', headers });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('idempotency_in_progress');
    await app.close();
  });

  it('uses an actor-scoped redis key with a TTL', async () => {
    const app = await buildServer();
    app.post(
      '/x',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => reply.send({}),
    );
    const { user, headers } = await authedUser();
    await app.inject({ method: 'POST', url: '/x', headers, payload: {} });
    const key = buildIdempotencyKey(user.id, 'POST', '/x', 'abc-123');
    const ttl = await getRedis().ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86_400);
    await app.close();
  });

  it('the query string is part of the request identity — a differing query on the same key is a mismatch', async () => {
    const app = await buildServer();
    app.get(
      '/query-idem',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => reply.send({ ok: true }),
    );
    const { headers } = await authedUser();
    const r1 = await app.inject({ method: 'GET', url: '/query-idem?scope=a', headers });
    const r2 = await app.inject({ method: 'GET', url: '/query-idem?scope=b', headers });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(409);
    expect(r2.json().code).toBe('idempotency_key_reused');
    await app.close();
  });

  it('two different path params on the same route pattern do not collide on the same client key', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post(
      '/resources/:id/idem',
      { onRequest: app.requireAuth, config: { idempotent: true } },
      async (_req, reply) => {
        calls += 1;
        return reply.status(201).send({ calls });
      },
    );
    const { headers } = await authedUser();
    const r1 = await app.inject({ method: 'POST', url: '/resources/aaa/idem', headers, payload: {} });
    const r2 = await app.inject({ method: 'POST', url: '/resources/bbb/idem', headers, payload: {} });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(calls).toBe(2);
    await app.close();
  });
});
