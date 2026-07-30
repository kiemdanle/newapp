import { randomUUID } from 'node:crypto';
import type { MediaOperationStatus, MediaOperationType, Prisma, PrismaClient } from '@prisma/client';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { removeKeyPrefix } from './product-media-storage.js';
import { isMediaFreezeActive } from './product-media-freeze.js';

type Db = PrismaClient | Prisma.TransactionClient;

const DEFAULT_PREPARED_LEASE_TTL_SECONDS = 60;
const PROCESSING_LEASE_TTL_SECONDS = 60;
const BASE_BACKOFF_SECONDS = 5;
const MAX_BACKOFF_SECONDS = 300;
const MAX_ATTEMPTS = 5;

export interface PreparedMediaIntent {
  id: string;
  leaseOwner: string;
}

interface OutboxPayload {
  keys: string[];
}

function payloadOf(row: { payload: unknown }): OutboxPayload {
  return row.payload as OutboxPayload;
}

/**
 * Commits a durable `prepared` intent for an operation that will write bytes to a
 * final private/public key *before* any DB reference is created — the load-bearing
 * primitive behind the phase's crash-recovery guarantee. Must be called (and
 * committed) before the first byte lands at any of `keys`; the caller's later
 * reference-changing transaction completes it atomically via `completeMediaOperation`.
 * A lease owner not renewed before `leaseTtlSeconds` elapses becomes eligible for
 * recovery by `processMediaOutboxOnce`.
 */
export async function prepareMediaOperation(
  tx: Db,
  input: { operation: MediaOperationType; keys: string[]; leaseTtlSeconds?: number },
): Promise<PreparedMediaIntent> {
  const leaseOwner = randomUUID();
  const ttl = input.leaseTtlSeconds ?? DEFAULT_PREPARED_LEASE_TTL_SECONDS;
  const row = await tx.mediaOperationOutbox.create({
    data: {
      operation: input.operation,
      payload: { keys: input.keys } as never,
      status: 'prepared',
      leaseOwner,
      leaseExpiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
  return { id: row.id, leaseOwner };
}

/** Renews a producer-held `prepared`/`processing` lease. Token-guarded by
 * `leaseOwner` so a lease that already expired (and was possibly reclaimed by a
 * recovery pass) can never be renewed by its original, now-stale holder. */
export async function renewMediaOperationLease(id: string, leaseOwner: string, leaseTtlSeconds = DEFAULT_PREPARED_LEASE_TTL_SECONDS): Promise<void> {
  const prisma = getPrisma();
  await prisma.mediaOperationOutbox.updateMany({
    where: { id, leaseOwner, status: { in: ['prepared', 'processing'] } },
    data: { leaseExpiresAt: new Date(Date.now() + leaseTtlSeconds * 1000) },
  });
}

/**
 * Completes a prepared intent atomically inside the caller's own reference-changing
 * transaction (e.g. the transaction that writes a photo's new `privateStorageKey`).
 * Must be called with the *same* `tx` that writes the reference — that's what makes
 * "bytes exist" and "reference exists" atomic together from an outside observer's
 * perspective, even though the bytes were physically written earlier.
 *
 * Fenced by `status: 'prepared'` + the exact `leaseOwner`: without this, a producer
 * whose lease expired while its reference transaction was still running (e.g. slow
 * `FOR UPDATE` contention) could "complete" an intent that `processMediaOutboxOnce`
 * had *already* claimed, found unreferenced, and deleted — committing a reference to
 * bytes that no longer exist, silently. Throwing here instead rolls
 * the whole reference transaction back, so the caller's own compensation path (or,
 * durably, a later outbox recovery pass) is what runs, never a dangling key.
 */
export async function completeMediaOperation(tx: Db, id: string, leaseOwner: string): Promise<void> {
  const result = await tx.mediaOperationOutbox.updateMany({
    where: { id, status: 'prepared', leaseOwner },
    data: { status: 'completed', leaseOwner: null, leaseExpiresAt: null },
  });
  if (result.count === 0) {
    throw new MediaOperationFencedError(id);
  }
}

/** Thrown by `completeMediaOperation` when its fencing predicate matches no row —
 * the intent was already recovered/expired out from under the caller. A distinct
 * class so callers can recognize "the reference transaction must not commit" versus
 * an ordinary DB error, without pattern-matching a message string. */
export class MediaOperationFencedError extends Error {
  constructor(id: string) {
    super(`media operation ${id} could not be completed: its prepared intent was not found (already recovered, completed, or a lease-owner mismatch)`);
    this.name = 'MediaOperationFencedError';
  }
}

/**
 * Enqueues a durable cleanup row for an operation whose DB reference change has
 * *already* committed (e.g. deleting a photo's old private variants after a reorder,
 * or the previous publication's private key after approval) — no lease needed until
 * a worker actually claims it. Must be called inside the same transaction as the
 * reference change it follows, so a process death between "reference committed" and
 * "cleanup enqueued" is impossible: either both happened, or neither did.
 */
export async function enqueueMediaCleanup(tx: Db, input: { operation: MediaOperationType; keys: string[] }): Promise<{ id: string } | null> {
  // `null`, not a sentinel empty-string id, for "nothing to enqueue" — an empty
  // string is indistinguishable from a real ID to a caller that forgets to check;
  // `null` forces the distinction at the type level.
  if (input.keys.length === 0) return null;
  const row = await tx.mediaOperationOutbox.create({
    data: {
      operation: input.operation,
      payload: { keys: input.keys } as never,
      status: 'pending',
    },
  });
  return { id: row.id };
}

function backoffSeconds(attempts: number): number {
  return Math.min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * 2 ** attempts);
}

/** True if any live photo row still references one of `keys` as its private or
 * public storage key prefix. The last-moment check that stands between a recovery
 * pass and an accidental deletion of bytes a reference transaction just committed to
 * using — checked immediately before every destructive filesystem operation, never
 * assumed from the outbox row's status alone. */
async function anyKeyStillReferenced(db: Db, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;
  const [photo, editPhoto] = await Promise.all([
    db.productPhoto.findFirst({
      where: { OR: [{ privateStorageKey: { in: keys } }, { publicStorageKey: { in: keys } }] },
      select: { id: true },
    }),
    db.productEditPhoto.findFirst({
      where: { privateStorageKey: { in: keys } },
      select: { id: true },
    }),
  ]);
  return Boolean(photo || editPhoto);
}

interface ClaimedRow {
  id: string;
  operation: MediaOperationType;
  status: MediaOperationStatus;
  attempts: number;
  payload: unknown;
}

async function claimBatch(workerId: string, limit: number): Promise<ClaimedRow[]> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id, operation, status, attempts, payload
      FROM media_operation_outbox
      WHERE (status = 'pending' AND available_at <= now())
         OR (status IN ('prepared', 'processing') AND lease_expires_at <= now())
      ORDER BY available_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];
    await tx.mediaOperationOutbox.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        status: 'processing',
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + PROCESSING_LEASE_TTL_SECONDS * 1000),
      },
    });
    return rows;
  });
}

// Both finalizers are guarded by `leaseOwner: workerId` (in addition to `id`):
// without it, a worker whose 60s processing lease expired mid-run — and whose row
// was already reclaimed and re-processed by a second worker — would still be able
// to overwrite `status`/`attempts`/`availableAt` on its way out, clobbering the
// second (live) worker's outcome. A count of 0 here just means
// this worker lost the row to a reclaim; that is the reclaiming worker's outcome to
// write, not an error for this one to raise.

async function finalizeSuccess(id: string, workerId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.mediaOperationOutbox.updateMany({
    where: { id, leaseOwner: workerId },
    data: { status: 'completed', leaseOwner: null, leaseExpiresAt: null },
  });
}

async function finalizeFailure(id: string, workerId: string, attempts: number, err: unknown): Promise<void> {
  const prisma = getPrisma();
  const nextAttempts = attempts + 1;
  const terminal = nextAttempts >= MAX_ATTEMPTS;
  await prisma.mediaOperationOutbox.updateMany({
    where: { id, leaseOwner: workerId },
    data: {
      status: terminal ? 'failed' : 'pending',
      leaseOwner: null,
      leaseExpiresAt: null,
      attempts: nextAttempts,
      availableAt: new Date(Date.now() + backoffSeconds(nextAttempts) * 1000),
      lastError: err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000),
    },
  });
}

export interface OutboxSweepResult {
  claimed: number;
  completed: number;
  failed: number;
}

/**
 * Claims and executes one batch of due outbox work: expired `prepared` intents
 * (recovering an unreferenced artifact, or safely no-op'ing a referenced one) and
 * ready `pending`/expired `processing` cleanup rows (deleting now-unreferenced
 * private/public keys). This is the claim/execute primitive only — Phase 7 wires it
 * into a real scheduled BullMQ worker; a post-commit enqueue is only ever a wake-up
 * hint, never the thing that guarantees progress. `FOR UPDATE SKIP LOCKED` inside a
 * short claim transaction means two concurrent callers can never both claim the same
 * row, so duplicate delivery (e.g. two wake-up signals for the same row) never
 * results in double processing.
 *
 * Skips the whole pass (returning all-zero counters, not an error) while a
 * backup freeze is active — this pass deletes now-unreferenced files, and a
 * `pg_dump` capture running concurrently could still be reading a row that
 * references one, or the manifest generator could still be walking the
 * filesystem tree this pass is mutating. Without this, the backup boundary
 * the phase requires ("no DB-referenced key changes between completed drain
 * and manifest capture") was not actually enforced for this pass.
 */
export async function processMediaOutboxOnce(limit = 10): Promise<OutboxSweepResult> {
  if (await isMediaFreezeActive()) {
    logger.info('media outbox sweep skipped — a backup freeze is active');
    return { claimed: 0, completed: 0, failed: 0 };
  }
  const prisma = getPrisma();
  const workerId = randomUUID();
  const rows = await claimBatch(workerId, limit);
  let completed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const keys = payloadOf(row).keys;
      const referenced = await anyKeyStillReferenced(prisma, keys);
      if (!referenced) {
        const root = getConfig().media.root;
        for (const key of keys) {
          await removeKeyPrefix(root, key);
        }
      } else {
        logger.warn(
          { outboxId: row.id, operation: row.operation, keys },
          'media outbox row recovered but its keys are still referenced; skipped deletion',
        );
      }
      await finalizeSuccess(row.id, workerId);
      completed++;
    } catch (err) {
      await finalizeFailure(row.id, workerId, row.attempts, err);
      failed++;
      logger.warn({ err, outboxId: row.id }, 'media outbox row processing failed');
    }
  }

  return { claimed: rows.length, completed, failed };
}

// ---------------------------------------------------------------------------
// Scheduler-independent poller. The phase spec requires
// "polling the durable outbox is authoritative; BullMQ delivery only
// accelerates it", but until now `processMediaOutboxOnce` had exactly one
// caller — the BullMQ-scheduled cleanup job. If the repeat key is ever lost
// (a Redis flush/eviction — this box already logs an allkeys-lru warning),
// `scheduleProductMediaCleanup` fails silently (fire-and-forget, error
// logged only), or the queue is paused, no prepared intent or pending
// cleanup would ever run again — orphan bytes accumulate with no signal.
// This plain `setInterval` runs in the same worker process, calls
// `processMediaOutboxOnce` directly, and has no dependency on BullMQ's
// scheduler at all.
// ---------------------------------------------------------------------------
let independentPollerHandle: ReturnType<typeof setInterval> | undefined;

/** Starts the scheduler-independent poll. Idempotent — calling this more
 * than once (e.g. a duplicate `startWorkers()` call) is a no-op, matching
 * `startWorkers`'s own already-started guard. */
export function startIndependentOutboxPoller(intervalMs = 60_000, limit = 25): void {
  if (independentPollerHandle) return;
  independentPollerHandle = setInterval(() => {
    processMediaOutboxOnce(limit).catch((err: unknown) => {
      logger.warn({ err }, 'independent outbox poller: tick failed');
    });
  }, intervalMs);
  independentPollerHandle.unref();
}

export function stopIndependentOutboxPoller(): void {
  if (independentPollerHandle) clearInterval(independentPollerHandle);
  independentPollerHandle = undefined;
}
