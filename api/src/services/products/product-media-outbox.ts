import { randomUUID } from 'node:crypto';
import type { MediaOperationStatus, MediaOperationType, Prisma, PrismaClient } from '@prisma/client';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { removeKeyPrefix } from './product-media-storage.js';

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
 */
export async function completeMediaOperation(tx: Db, id: string): Promise<void> {
  await tx.mediaOperationOutbox.update({
    where: { id },
    data: { status: 'completed', leaseOwner: null, leaseExpiresAt: null },
  });
}

/**
 * Enqueues a durable cleanup row for an operation whose DB reference change has
 * *already* committed (e.g. deleting a photo's old private variants after a reorder,
 * or the previous publication's private key after approval) — no lease needed until
 * a worker actually claims it. Must be called inside the same transaction as the
 * reference change it follows, so a process death between "reference committed" and
 * "cleanup enqueued" is impossible: either both happened, or neither did.
 */
export async function enqueueMediaCleanup(tx: Db, input: { operation: MediaOperationType; keys: string[] }): Promise<{ id: string }> {
  if (input.keys.length === 0) return { id: '' };
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

async function finalizeSuccess(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.mediaOperationOutbox.update({
    where: { id },
    data: { status: 'completed', leaseOwner: null, leaseExpiresAt: null },
  });
}

async function finalizeFailure(id: string, attempts: number, err: unknown): Promise<void> {
  const prisma = getPrisma();
  const nextAttempts = attempts + 1;
  const terminal = nextAttempts >= MAX_ATTEMPTS;
  await prisma.mediaOperationOutbox.update({
    where: { id },
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
 */
export async function processMediaOutboxOnce(limit = 10): Promise<OutboxSweepResult> {
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
      await finalizeSuccess(row.id);
      completed++;
    } catch (err) {
      await finalizeFailure(row.id, row.attempts, err);
      failed++;
      logger.warn({ err, outboxId: row.id }, 'media outbox row processing failed');
    }
  }

  return { claimed: rows.length, completed, failed };
}
