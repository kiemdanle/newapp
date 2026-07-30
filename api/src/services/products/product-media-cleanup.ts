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

/** Internal-only signal that a candidate stopped being eligible somewhere
 * between the initial scan and the locked, authoritative re-check — never a
 * real error, just the transaction's abort-and-roll-back mechanism. Thrown
 * from inside `$transaction` so Prisma rolls back everything in that
 * transaction (including any `enqueueMediaCleanup` insert already made). */
class DraftNoLongerEligibleError extends Error {}

/**
 * Deletes draft products that are: `draft` status, whose `updatedAt` is
 * older than 30 days (last *activity*, not creation — a draft created 31
 * days ago but edited yesterday is not abandoned; reviewer-p7 M11), have no
 * personal `Record` referencing them, and no open (`draft`/`pending`/
 * `changes_required`) `ProductEdit` (reviewer-p7 M8: `pending` alone missed
 * the other two open states the enum actually has).
 *
 * The delete itself is conditional — `deleteMany` re-checking `status` and
 * `updatedAt` again, inside a transaction that first takes `SELECT ... FOR
 * UPDATE` on the row — rather than trusting the unlocked pre-check above.
 * Without this, a product that left `draft` (e.g. a concurrent submit)
 * between the pre-check and the delete was deleted anyway, taking its photo
 * bytes with it (reviewer-p7 C1, proven data loss). `FOR UPDATE` also
 * serializes against another concurrent sweep candidate touching the same
 * row, though in practice each row is only ever a candidate once per pass.
 *
 * Any private/public photo bytes are handed to the durable outbox for
 * cleanup inside the same transaction that deletes the row — never deleted
 * inline — so a crash between the two can only ever leave an orphaned
 * *file* (which the outbox's own crash-recovery already handles), never an
 * orphaned DB reference to already-deleted bytes. Each namespace is
 * enqueued under its own operation (reviewer-p7 M10: the previous
 * `private ?? public` fallback silently dropped whichever key lost, and
 * always labelled the result `delete_private` even for a public key).
 */
export async function sweepStaleProductDrafts(
  limit: number,
  dryRun = false,
  /** Test-only: invoked once per candidate immediately after the unlocked
   * pre-check confirms eligibility, strictly before the locked transaction
   * opens — the exact window reviewer-p7's C1 finding proved vulnerable.
   * Lets a test deterministically inject a concurrent mutation there without
   * spying on Prisma's client (whose model delegates don't restore cleanly
   * after `vi.spyOn`/`mockRestore` in this Prisma version). Never used in
   * production; defaults to a no-op. */
  onBeforeLockedRecheck: (productId: string) => Promise<void> = async () => {},
): Promise<StaleDraftSweepResult> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - STALE_DRAFT_AGE_MS);

  const candidates = await prisma.product.findMany({
    where: { status: 'draft', updatedAt: { lt: cutoff } },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });

  let deleted = 0;
  let skippedReferenced = 0;

  for (const candidate of candidates) {
    // Cheap, unlocked pre-check so an obviously-referenced candidate never
    // pays for opening a transaction at all. Not authoritative by itself —
    // see the locked re-check inside the transaction below.
    const fresh = await prisma.product.findUnique({
      where: { id: candidate.id },
      include: { photos: { select: { privateStorageKey: true, publicStorageKey: true } } },
    });
    if (!fresh || fresh.status !== 'draft' || fresh.updatedAt >= cutoff) continue;

    await onBeforeLockedRecheck(fresh.id);

    const [recordCount, openEditCount] = await Promise.all([
      prisma.record.count({ where: { productId: fresh.id } }),
      prisma.productEdit.count({ where: { productId: fresh.id, status: { in: ['draft', 'pending', 'changes_required'] } } }),
    ]);
    if (recordCount > 0 || openEditCount > 0) {
      skippedReferenced += 1;
      continue;
    }

    if (dryRun) {
      deleted += 1;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Locks this row against any other concurrent writer of it (a
        // submit, a patch, another sweep pass) — everything below only ever
        // sees a state no one else is mid-write on.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "products" WHERE "id" = ${fresh.id}::uuid FOR UPDATE
        `;
        if (locked.length === 0) throw new DraftNoLongerEligibleError();

        const [recordCountTx, openEditCountTx] = await Promise.all([
          tx.record.count({ where: { productId: fresh.id } }),
          tx.productEdit.count({ where: { productId: fresh.id, status: { in: ['draft', 'pending', 'changes_required'] } } }),
        ]);
        if (recordCountTx > 0 || openEditCountTx > 0) throw new DraftNoLongerEligibleError();

        // The actual gate: re-checks status and updatedAt atomically against
        // the row this transaction now holds a lock on, never trusting the
        // pre-check above (reviewer-p7 C1).
        const result = await tx.product.deleteMany({
          where: { id: fresh.id, status: 'draft', updatedAt: { lt: cutoff } },
        });
        if (result.count === 0) throw new DraftNoLongerEligibleError();

        // ProductPhoto rows cascade-delete with the Product (schema:
        // onDelete: Cascade); these outbox entries are what actually remove
        // the bytes. Grouped by which namespace each photo was actually in
        // — a photo has private XOR public storage, never both, but the
        // grouping stays correct even if that ever changes.
        const privateKeys = fresh.photos.map((p) => p.privateStorageKey).filter((k): k is string => k !== null);
        const publicKeys = fresh.photos.map((p) => p.publicStorageKey).filter((k): k is string => k !== null);
        if (privateKeys.length > 0) await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: privateKeys });
        if (publicKeys.length > 0) await enqueueMediaCleanup(tx, { operation: 'delete_public', keys: publicKeys });
      });
      deleted += 1;
    } catch (err) {
      if (err instanceof DraftNoLongerEligibleError) {
        skippedReferenced += 1;
        continue;
      }
      throw err;
    }
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
 * real upload takes anywhere near that long). Bounded by `limit` and
 * `dryRun`-capable, matching `sweepStaleProductDrafts`'s shape (reviewer-p7
 * M9: an unbounded `readdir`+per-entry `stat` walk with no way to preview
 * before deleting was itself a "not bounded, not dry-run-capable" gap
 * against the phase's own requirement).
 */
export async function sweepStaleQuarantine(limit = 1000, dryRun = false): Promise<StaleQuarantineSweepResult> {
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
  let scanned = 0;
  let deleted = 0;
  for (const entry of entries) {
    if (scanned >= limit) break;
    scanned += 1;
    const entryPath = mediaKeyToPath(root, quarantineDirKey(entry));
    let mtimeMs: number;
    try {
      mtimeMs = (await stat(entryPath)).mtimeMs;
    } catch {
      continue; // vanished between readdir and stat — nothing to do
    }
    if (mtimeMs >= cutoff) continue;
    if (dryRun) {
      deleted += 1;
      continue;
    }
    try {
      await removeKeyPrefix(root, quarantineDirKey(entry));
      deleted += 1;
    } catch (err) {
      logger.warn({ err, entry }, 'product-media-cleanup: failed to remove stale quarantine entry');
    }
  }
  return { scanned, deleted };
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
