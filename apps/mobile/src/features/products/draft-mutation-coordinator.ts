import type { UploadHandle, UploadablePhoto } from '../../api/product-photo-upload';
import { isApiError } from '../../api/errors';

// One serialized queue per draft/edit target — metadata patches and photo
// mutations (upload/delete/order) all funnel through the same execution
// chain, so the server never sees two concurrent writes racing for the same
// `version`. This is deliberately the highest-tested module in Phase 5
// (plan.md's own risk table calls "lost local intent" Medium/High) — every
// behavior here is proven against fixtures that resolve responses
// out of order before any real screen depends on it (Task 6).

/** The minimal photo projection both `ProductPhoto` and `ProductEditPhoto`
 * satisfy (the latter also carries `retained`, irrelevant to the
 * coordinator/editor's own bookkeeping — only position and identity matter
 * for queueing/reordering). */
export interface CoordinatedEntityPhoto {
  id: string;
  position: number;
  thumbnailUrl: string;
}

/** The minimal shape both `Product` (drafts) and `ProductEditRow` (active
 * revisions) satisfy — the coordinator itself never imports either type, so
 * the same implementation serves both Task 5 (drafts) and Task 8
 * (active-revision editor) targets. */
export interface CoordinatedEntity {
  id: string;
  version: number;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  photos: readonly CoordinatedEntityPhoto[];
}

export interface MetadataFields {
  name?: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
}

export type CoordinatorOperation =
  | { kind: 'metadata'; fields: MetadataFields }
  | {
      kind: 'upload';
      photo: UploadablePhoto;
      onProgress?: (ratio: number) => void;
      /** Called synchronously with the transport's real `cancel()` as soon
       * as the upload starts (before the network response arrives) — the
       * only way a caller can actually abort an in-flight upload, since
       * `enqueue()` itself only returns the eventual `Promise<T>`. */
      onHandle?: (handle: { cancel: () => void }) => void;
    }
  | { kind: 'delete'; photoId: string }
  | { kind: 'order'; photoIds: string[] };

export interface ConflictInfo<T extends CoordinatedEntity> {
  currentVersion: number;
  serverEntity: T;
  /** Fields the caller had already queued-but-unsent when the conflict hit —
   * these are what `reconcileConflict('retry')` re-sends against the fresh
   * version; `reconcileConflict('discard-local')` drops them instead. */
  pendingFields: MetadataFields;
}

export interface CoordinatorAdapter<T extends CoordinatedEntity> {
  patchMetadata(id: string, version: number, fields: MetadataFields): Promise<T>;
  refetch(id: string): Promise<T>;
  uploadPhoto(photo: UploadablePhoto): UploadHandle<T>;
  deletePhoto(photoId: string): Promise<T>;
  orderPhotos(photoIds: string[]): Promise<T>;
}

export interface DraftMutationCoordinator<T extends CoordinatedEntity> {
  /** Queues one operation. Metadata operations coalesce: several calls
   * queued before the first one executes merge into a single PATCH, and all
   * of their callers resolve with that one flush's result. Non-metadata
   * operations first flush any pending metadata (so the version they see is
   * current), then run in strict arrival order after that. */
  enqueue(operation: CoordinatorOperation): Promise<T>;
  /** Forces an immediate flush of whatever metadata is currently buffered,
   * queued behind anything already in flight. Resolves with the current
   * entity if nothing was dirty. */
  flushMetadata(): Promise<T>;
  /** Resolves the coordinator's current conflict. `retry` re-sends the
   * caller's still-pending local fields against the version learned from
   * the conflict's refetch; `discard-local` accepts the server's fields as
   * authoritative and drops whatever was locally dirty. No-ops if there is
   * no active conflict. */
  reconcileConflict(resolution: 'retry' | 'discard-local'): Promise<T>;
  /** The coordinator's current best-known entity state (server-authoritative
   * fields merged with whatever's still locally dirty). */
  getState(): T;
  /** True while a conflict is blocking the queue — callers should disable
   * further edits/submit until this clears. */
  hasConflict(): boolean;
  onConflict(listener: (info: ConflictInfo<T>) => void): () => void;
}

function applyDirty<T extends CoordinatedEntity>(entity: T, fields: MetadataFields): T {
  return {
    ...entity,
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    ...(fields.brand !== undefined ? { brand: fields.brand } : {}),
    ...(fields.category !== undefined ? { category: fields.category } : {}),
  };
}

function mergeFields(base: MetadataFields, next: MetadataFields): MetadataFields {
  return { ...base, ...next };
}

export function createDraftMutationCoordinator<T extends CoordinatedEntity>(
  adapter: CoordinatorAdapter<T>,
  initial: T,
): DraftMutationCoordinator<T> {
  // `known` is the last server-confirmed state; `pendingFields` is dirty
  // metadata not yet successfully saved. `getState()` always reflects
  // `known` with `pendingFields` applied on top, so the UI never shows a
  // value the user didn't type or the server didn't confirm.
  let known: T = initial;
  let pendingFields: MetadataFields = {};
  let pendingWaiters: Array<{ resolve: (v: T) => void; reject: (e: unknown) => void }> = [];
  let metadataFlushScheduled = false;
  let conflict: ConflictInfo<T> | null = null;
  const conflictListeners = new Set<(info: ConflictInfo<T>) => void>();

  // The serialization primitive: every operation appends to this chain, so
  // the next one's server call never starts before the previous one's
  // response (success or failure) has been fully processed.
  let tail: Promise<unknown> = Promise.resolve();

  function notifyConflict(info: ConflictInfo<T>): void {
    conflict = info;
    for (const l of conflictListeners) l(info);
  }

  // Deliberately never throws/rejects — every outcome (success, conflict,
  // hard failure) is delivered to the waiters queued for this exact flush
  // instead. This keeps the internal sequencing chain (`tail`, below) always
  // in a resolved state, so a failed flush that nothing later happens to
  // chain off of can never surface as a Node unhandled-rejection: the error
  // still reaches every real caller (via their own `enqueue()`/
  // `flushMetadata()` promise), just never through `tail` itself.
  async function doMetadataFlush(): Promise<T> {
    if (conflict) {
      // A previous flush already hit a conflict that hasn't been resolved —
      // don't send another write into it; let it resolve into this one.
      const waiters = pendingWaiters;
      pendingWaiters = [];
      for (const w of waiters) w.resolve(known);
      return known;
    }
    if (Object.keys(pendingFields).length === 0) {
      const waiters = pendingWaiters;
      pendingWaiters = [];
      for (const w of waiters) w.resolve(known);
      return known;
    }
    // Snapshot what's being sent — a genuine copy, not just a reference:
    // `pendingFields` deliberately stays populated (unchanged object or
    // not) for the duration of the request so `getState()` keeps showing
    // the user's typed values while the save is in flight. If `fields` were
    // just `pendingFields` by reference rather than a copy, deleting a sent
    // key from `pendingFields` after the request settles would silently
    // mutate `fields` too whenever no new edit happened to reassign
    // `pendingFields` to a new object in between — corrupting the exact
    // snapshot that was already sent (and anyone still holding a reference
    // to it, tests included). Only the *waiters* for this exact batch are
    // captured now; anyone who enqueues more edits while this request is
    // outstanding gets fresh waiters, coalesced into the next flush.
    const fields = { ...pendingFields };
    const waiters = pendingWaiters;
    pendingWaiters = [];
    try {
      const updated = await adapter.patchMetadata(known.id, known.version, fields);
      known = updated;
      // Clear exactly the keys this request sent, but only where nothing
      // newer overwrote them while the request was in flight — a fresher
      // pending edit for the same key must survive to the next flush.
      for (const key of Object.keys(fields) as Array<keyof MetadataFields>) {
        if (pendingFields[key] === fields[key]) delete pendingFields[key];
      }
      for (const w of waiters) w.resolve(updated);
      return updated;
    } catch (err) {
      if (isApiError(err) && err.code === 'version_conflict') {
        const serverEntity = await adapter.refetch(known.id);
        // Server-authoritative for everything NOT still dirty; the fields
        // this exact flush attempt was trying to save stay as the caller's
        // local intent until they explicitly choose retry or discard.
        known = serverEntity;
        notifyConflict({ currentVersion: serverEntity.version, serverEntity, pendingFields: fields });
        pendingWaiters = waiters;
        return applyDirty(serverEntity, pendingFields);
      }
      // A hard (non-conflict) failure: these specific callers are told: the
      // fields stay dirty (still in `pendingFields`, untouched above) so a
      // later retry can pick them up rather than silently losing the edit.
      for (const w of waiters) w.reject(err);
      return applyDirty(known, pendingFields);
    }
  }

  function run<R>(fn: () => Promise<R>): Promise<R> {
    const next = tail.then(fn, fn);
    // `tail` itself must never carry a rejection forward with no handler —
    // callers observe failures through the promise `run()` returns, not
    // through `tail`, which exists purely to serialize start times.
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function queueMetadataFlush(): void {
    if (metadataFlushScheduled) return;
    metadataFlushScheduled = true;
    void run(async () => {
      metadataFlushScheduled = false;
      return doMetadataFlush();
    });
  }

  return {
    enqueue(operation) {
      if (operation.kind === 'metadata') {
        pendingFields = mergeFields(pendingFields, operation.fields);
        return new Promise<T>((resolve, reject) => {
          pendingWaiters.push({ resolve, reject });
          queueMetadataFlush();
        });
      }

      // Every non-metadata operation flushes first: the server must see the
      // caller's latest metadata before a photo mutation runs, even though
      // photo mutations themselves never carry a version precondition
      // (plan.md's deliberate exception — independent per-photo retry
      // design plus the per-product row lock already prevent lost updates).
      return run(async () => {
        await doMetadataFlush();
        if (conflict) {
          // Don't run photo mutations against a product state the caller
          // hasn't confirmed past the conflict yet.
          return known;
        }
        switch (operation.kind) {
          case 'upload': {
            const handle = adapter.uploadPhoto(operation.photo);
            if (operation.onProgress) handle.onProgress(operation.onProgress);
            operation.onHandle?.({ cancel: handle.cancel });
            const updated = await handle.promise;
            known = updated;
            return updated;
          }
          case 'delete': {
            const updated = await adapter.deletePhoto(operation.photoId);
            known = updated;
            return updated;
          }
          case 'order': {
            const updated = await adapter.orderPhotos(operation.photoIds);
            known = updated;
            return updated;
          }
        }
      });
    },

    flushMetadata() {
      return run(() => doMetadataFlush());
    },

    reconcileConflict(resolution) {
      return run(async () => {
        if (!conflict) return known;
        const resolved = conflict;
        conflict = null;
        if (resolution === 'discard-local') {
          pendingFields = {};
          const waiters = pendingWaiters;
          pendingWaiters = [];
          known = resolved.serverEntity;
          for (const w of waiters) w.resolve(known);
          return known;
        }
        // retry: re-send the pending fields against the now-current version.
        known = resolved.serverEntity;
        pendingFields = resolved.pendingFields;
        return doMetadataFlush();
      });
    },

    getState() {
      return applyDirty(known, pendingFields);
    },

    hasConflict() {
      return conflict !== null;
    },

    onConflict(listener) {
      conflictListeners.add(listener);
      return () => conflictListeners.delete(listener);
    },
  };
}
