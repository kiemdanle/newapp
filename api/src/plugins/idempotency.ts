import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { getRedis } from '../redis.js';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '@expyrico/shared';

declare module 'fastify' {
  interface FastifyContextConfig {
    idempotent?: boolean | 'required';
  }
  interface FastifyRequest {
    /** Set when this request holds the write reservation for its idempotency key. */
    idempotencyReservationKey?: string;
  }
}

// Completed responses are replayable for a day; an in-flight reservation is much
// shorter-lived so a process that dies mid-request can't wedge the key forever.
//
// IN_FLIGHT_TTL_SECONDS is a hard latent bound: no route handler in this
// codebase can run anywhere close to 30s (no synchronous external calls
// live under an idempotent route today). If a future idempotent route can
// legitimately take longer, this reservation must be heartbeated/extended
// from within the handler, or it will lapse and let a retry double-execute
// concurrently with a still-live original — do not just raise this constant
// without also solving that.
const COMPLETE_TTL_SECONDS = 24 * 60 * 60;
const IN_FLIGHT_TTL_SECONDS = 30;
const WAIT_POLL_MS = 40;
const WAIT_TIMEOUT_MS = 2_000;

interface CachedResponse {
  status: number;
  body: string;
  contentType: string | undefined;
}

interface InFlightRecord {
  state: 'in_flight';
  requestHash: string;
}

interface CompleteRecord {
  state: 'complete';
  requestHash: string;
  response: CachedResponse;
}

type IdempotencyRecord = InFlightRecord | CompleteRecord;

// Deterministic string form of a JSON-ish value with object keys sorted, so two
// logically identical bodies with different key order hash the same.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

// The query string is part of the request's identity for hashing purposes —
// two requests that differ only in query params are not "the same" retry.
function hashRequest(body: unknown, query: unknown): string {
  return createHash('sha256').update(stableStringify({ body: body ?? null, query: query ?? null })).digest('hex');
}

/** Exported for tests that need to manipulate a reservation directly in Redis.
 * `route` should be the canonical route pattern (`req.routeOptions.url`, e.g.
 * `/drafts/:id/submit`) plus resolved path params folded in — not the raw
 * concrete URL — so the key is actually "this operation on this resource",
 * matching the Produced Interfaces' "canonical route" language. */
export function buildIdempotencyKey(
  actorId: string,
  method: string,
  route: string,
  clientKey: string,
): string {
  return `idem:${actorId}:${method}:${route}:${clientKey}`;
}

function canonicalRoute(req: FastifyRequest): string {
  const pattern = req.routeOptions.url ?? req.url.split('?')[0] ?? req.url;
  const params = req.params as Record<string, unknown> | undefined;
  if (!params || Object.keys(params).length === 0) return pattern;
  return `${pattern}#${stableStringify(params)}`;
}

// Atomically "reserve or read": if the key is absent, create it as an in_flight
// reservation and report that; if present, return its current value untouched.
// Running as a single Lua script closes the race window a plain GET-then-SET pair
// would leave between two concurrent requests for the same key.
const RESERVE_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing then
  return existing
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 'RESERVED'
`;

async function reserve(key: string, record: InFlightRecord): Promise<'reserved' | IdempotencyRecord> {
  const redis = getRedis();
  const result = (await redis.eval(
    RESERVE_SCRIPT,
    1,
    key,
    JSON.stringify(record),
    IN_FLIGHT_TTL_SECONDS,
  )) as string;
  if (result === 'RESERVED') return 'reserved';
  return JSON.parse(result) as IdempotencyRecord;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type WaitResult =
  | { kind: 'complete'; record: CompleteRecord }
  | { kind: 'vacated' }
  | { kind: 'timeout' };

// Polls a reservation already known to be in_flight for the same request hash.
// `vacated` means the reservation disappeared (TTL expiry / crash recovery) before
// the wait bound — safe for the caller to become the new executor. `timeout` means
// the original holder may still be actively processing — the caller must not race
// it, so preHandler turns this into a retryable error instead of re-executing.
async function waitForCompletion(key: string, requestHash: string): Promise<WaitResult> {
  const redis = getRedis();
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(WAIT_POLL_MS);
    const raw = await redis.get(key);
    if (!raw) return { kind: 'vacated' };
    const record = JSON.parse(raw) as IdempotencyRecord;
    if (record.requestHash !== requestHash) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        title: 'Idempotency-Key was reused with a different request body',
      });
    }
    if (record.state === 'complete') return { kind: 'complete', record };
  }
  return { kind: 'timeout' };
}

function sendCached(reply: FastifyReply, cached: CachedResponse): FastifyReply {
  if (cached.contentType) void reply.type(cached.contentType);
  void reply.status(cached.status).send(cached.body);
  return reply;
}

export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const cfg = req.routeOptions.config?.idempotent;
    if (!cfg) return;

    const header = req.headers['idempotency-key'];
    const clientKey = Array.isArray(header) ? header[0] : header;
    if (!clientKey) {
      if (cfg === 'required') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Idempotency-Key header is required',
        });
      }
      return;
    }

    // Idempotency is actor-bound. Auth (onRequest) runs before this plugin's
    // preHandler hook (registration order in server.ts), so req.user is already
    // populated for authenticated routes. Without an actor there is no safe
    // binding to cache under, so the request always executes uncached.
    const actorId = req.user?.id;
    if (!actorId) return;

    const key = buildIdempotencyKey(actorId, req.method, canonicalRoute(req), clientKey);
    const requestHash = hashRequest(req.body, req.query);

    const outcome = await reserve(key, { state: 'in_flight', requestHash });
    if (outcome === 'reserved') {
      req.idempotencyReservationKey = key;
      return;
    }

    if (outcome.requestHash !== requestHash) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        title: 'Idempotency-Key was reused with a different request body',
      });
    }

    if (outcome.state === 'complete') {
      return sendCached(reply, outcome.response);
    }

    // Same actor/body replaying while the original request is still in flight —
    // wait boundedly for it to finish rather than double-executing the handler.
    const waited = await waitForCompletion(key, requestHash);
    if (waited.kind === 'complete') {
      return sendCached(reply, waited.record.response);
    }
    if (waited.kind === 'vacated') {
      // The original reservation disappeared (crashed worker, TTL expiry) — no one
      // else holds it, so it's safe to become the new executor.
      const retried = await reserve(key, { state: 'in_flight', requestHash });
      if (retried === 'reserved') {
        req.idempotencyReservationKey = key;
        return;
      }
      // Someone else won the reservation in the tiny window between our vacated
      // check and this reserve call — never race them; ask the caller to retry.
    }
    throw new AppError({
      status: 409,
      code: ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
      title: 'Request is still processing; retry shortly',
    });
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload) => {
    const key = req.idempotencyReservationKey;
    if (!key) return payload;
    const redis = getRedis();
    if (reply.statusCode >= 500) {
      // Never cache a server error; release the reservation so a retry is fresh
      // instead of waiting out the full in-flight TTL.
      await redis.del(key);
      return payload;
    }
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const record: CompleteRecord = {
      state: 'complete',
      requestHash: hashRequest(req.body, req.query),
      response: {
        status: reply.statusCode,
        body,
        contentType: reply.getHeader('content-type')?.toString(),
      },
    };
    await redis.set(key, JSON.stringify(record), 'EX', COMPLETE_TTL_SECONDS);
    return payload;
  });
});
