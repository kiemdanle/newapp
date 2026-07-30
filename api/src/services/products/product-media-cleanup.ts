// Phase 7: bounded, dry-run-capable cleanup passes. Every deletion condition is
// re-checked immediately before acting (state can change between the initial
// scan and the delete), and every filesystem removal is routed through the
// durable outbox (`enqueueMediaCleanup`) rather than deleted inline, so a
// crash mid-sweep can never leave a DB row pointing at bytes that are already
// gone, or vice versa.
import { readdir, stat } from 'node:fs/promises';
import { getPrisma } from '../../db.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';
import { enqueueMediaCleanup } from './product-media-outbox.js';
import { mediaKeyToPath, quarantineDirKey, removeKeyPrefix } from './product-media-storage.js';

const STALE_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_QUARANTINE_AGE_MS = 24 * 60 * 60 * 1000;

export interface StaleDraftSweepResult {
  scanned: number;
  deleted: number;
  skippedReferenced: number;
}

/**
 * Deletes draft products that are: `draft` status, older than 30 days, have no
 * personal `Record` referencing them, and no open (`pending`) `ProductEdit`.
 * Any private photo bytes are handed to the durable outbox for cleanup inside
 * the same transaction that deletes the row — never deleted inline — so a
 * crash between the two can only ever leave an orphaned *file* (which the
 * outbox's own crash-recovery already handles), never an orphaned DB
 * reference to already-deleted bytes.
 */
export async function sweepStaleProductDrafts(limit: number, dryRun = false): Promise<StaleDraftSweepResult> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - STALE_DRAFT_AGE_MS);

  const candidates = await prisma.product.findMany({
    where: { status: 'draft', createdAt: { lt: cutoff } },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  let deleted = 0;
  let skippedReferenced = 0;

  for (const candidate of candidates) {
    // Re-check state immediately before deleting — the initial scan above is
    // not authoritative by itself (a concurrent patch/resubmit/moderation
    // action could have changed status or bumped updatedAt since).
    const fresh = await prisma.product.findUnique({
      where: { id: candidate.id },
      include: { photos: { select: { privateStorageKey: true, publicStorageKey: true } } },
    });
    if (!fresh || fresh.status !== 'draft' || fresh.createdAt >= cutoff) continue;

    const [recordCount, openEditCount] = await Promise.all([
      prisma.record.count({ where: { productId: fresh.id } }),
      prisma.productEdit.count({ where: { productId: fresh.id, status: 'pending' } }),
    ]);
    if (recordCount > 0 || openEditCount > 0) {
      skippedReferenced += 1;
      continue;
    }

    if (dryRun) {
      deleted += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction too — the gap between the check above
      // and acquiring the row here is real under concurrency (e.g. a
      // just-created Record row for the same product).
      const [recordCountTx, openEditCountTx] = await Promise.all([
        tx.record.count({ where: { productId: fresh.id } }),
        tx.productEdit.count({ where: { productId: fresh.id, status: 'pending' } }),
      ]);
      if (recordCountTx > 0 || openEditCountTx > 0) return;

      const keys = fresh.photos
        .map((p) => p.privateStorageKey ?? p.publicStorageKey)
        .filter((k): k is string => k !== null);
      if (keys.length > 0) {
        await enqueueMediaCleanup(tx, { operation: 'delete_private', keys });
      }
      // ProductPhoto rows cascade-delete with the Product (schema: onDelete:
      // Cascade); the outbox entry above is what actually removes the bytes.
      await tx.product.delete({ where: { id: fresh.id } });
    });
    deleted += 1;
  }

  return { scanned: candidates.length, deleted, skippedReferenced };
}

export interface StaleQuarantineSweepResult {
  scanned: number;
  deleted: number;
}

/**
 * Removes quarantine directories left behind by a process that crashed
 * between accepting an upload and either promoting or cleaning it up in
 * `photo-upload.ts`'s `finally` block. Quarantine entries are named by
 * request ID with no DB row at all, so this is a pure filesystem sweep keyed
 * on directory mtime — anything older than 24h is provably abandoned (no
 * real upload takes anywhere near that long).
 */
export async function sweepStaleQuarantine(): Promise<StaleQuarantineSweepResult> {
  const root = getConfig().media.root;
  const quarantineRoot = mediaKeyToPath(root, 'quarantine');
  let entries: string[];
  try {
    entries = await readdir(quarantineRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { scanned: 0, deleted: 0 };
    throw err;
  }

  const cutoff = Date.now() - STALE_QUARANTINE_AGE_MS;
  let deleted = 0;
  for (const entry of entries) {
    const entryPath = mediaKeyToPath(root, quarantineDirKey(entry));
    let mtimeMs: number;
    try {
      mtimeMs = (await stat(entryPath)).mtimeMs;
    } catch {
      continue; // vanished between readdir and stat — nothing to do
    }
    if (mtimeMs >= cutoff) continue;
    try {
      await removeKeyPrefix(root, quarantineDirKey(entry));
      deleted += 1;
    } catch (err) {
      logger.warn({ err, entry }, 'product-media-cleanup: failed to remove stale quarantine entry');
    }
  }
  return { scanned: entries.length, deleted };
}

/** Read-only — the oldest quarantine entry's age in milliseconds, or `null`
 * when the quarantine tree is empty/missing. Health-endpoint primitive
 * (Phase 7 Task 7); never deletes anything, unlike `sweepStaleQuarantine`. */
export async function oldestQuarantineAgeMs(): Promise<number | null> {
  const root = getConfig().media.root;
  const quarantineRoot = mediaKeyToPath(root, 'quarantine');
  let entries: string[];
  try {
    entries = await readdir(quarantineRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  let oldestMtimeMs: number | null = null;
  for (const entry of entries) {
    try {
      const mtimeMs = (await stat(mediaKeyToPath(root, quarantineDirKey(entry)))).mtimeMs;
      if (oldestMtimeMs === null || mtimeMs < oldestMtimeMs) oldestMtimeMs = mtimeMs;
    } catch {
      continue;
    }
  }
  return oldestMtimeMs === null ? null : Date.now() - oldestMtimeMs;
}
