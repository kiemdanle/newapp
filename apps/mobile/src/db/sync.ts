import { removeRecordLocalPhotos } from '../features/records/record-photo-storage';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from './index';
import { apiClient } from '../api/client';
import { isApiError } from '../api/errors';
import { getItem, setItem } from '../auth/secure-store';
import { ERROR_CODES, type RecordSyncResponse, type RecordSyncBatch } from '@expyrico/shared';
import { syncQuotaErrorsStore } from '../store/syncQuotaErrorsStore';
import { useSyncStateStore } from '../store/syncStateStore';

export const LAST_SYNC_KEY = 'pantry.lastSyncAt';

let syncing = false;
let currentSyncEpoch = 0;
let pendingSyncRequestedEpoch: number | null = null;

export function invalidateSyncEpoch(): void {
  currentSyncEpoch++;
  pendingSyncRequestedEpoch = null;
}

export function isSyncEpochValid(runEpoch?: number): boolean {
  return runEpoch === undefined || runEpoch === currentSyncEpoch;
}

export async function runSync(): Promise<void> {
  const runEpoch = currentSyncEpoch;
  if (syncing) {
    pendingSyncRequestedEpoch = runEpoch;
    return;
  }
  syncing = true;
  useSyncStateStore.getState().setSyncStart();
  try {
    await pushPending(runEpoch);
    if (!isSyncEpochValid(runEpoch)) return;
    await pullSince(runEpoch);
    if (!isSyncEpochValid(runEpoch)) return;
    useSyncStateStore.getState().setSyncSuccess();
  } catch (err: unknown) {
    console.error('[runSync] Sync failed:', err);
    if (isSyncEpochValid(runEpoch)) {
      useSyncStateStore.getState().setSyncError(err);
    }
  } finally {
    syncing = false;
    if (pendingSyncRequestedEpoch !== null && isSyncEpochValid(pendingSyncRequestedEpoch)) {
      pendingSyncRequestedEpoch = null;
      void runSync();
    }
  }
}

export function getWirePhotoUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (item): item is string =>
            typeof item === 'string' &&
            (item.startsWith('http://') || item.startsWith('https://')),
        );
        if (first) return first;
      }
    } catch {
      // ignore invalid json
    }
  }
  return null;
}

async function pushPending(runEpoch: number): Promise<void> {
  if (!isSyncEpochValid(runEpoch)) return;
  const recordsCol = database.get<RecordModel>('records');

  // STEP 1: Process deletes first
  const deletes = await recordsCol.query(Q.where('pending_delete', true)).fetch();
  for (const rec of deletes) {
    if (!isSyncEpochValid(runEpoch)) return;
    try {
      if (rec.serverId) {
        await apiClient.delete(`/records/${rec.serverId}`);
      }
    } catch (err: unknown) {
      const e = err as { status?: number; response?: { status?: number } };
      const status = e?.status ?? e?.response?.status;
      if (status !== 403 && status !== 404) {
        throw err;
      }
    }
    if (!isSyncEpochValid(runEpoch)) return;
    await database.write(async () => {
      if (!isSyncEpochValid(runEpoch)) return;
      await removeRecordLocalPhotos(rec.clientId);
      if (!isSyncEpochValid(runEpoch)) return;
      await rec.destroyPermanently();
    });
    syncQuotaErrorsStore.remove(rec.clientId);
  }

  // STEP 2: Query surviving dirty records (pending_delete == false)
  if (!isSyncEpochValid(runEpoch)) return;
  const dirty = await recordsCol
    .query(Q.where('pending_sync', true), Q.where('pending_delete', false))
    .fetch();

  // Partition dirty records to process capacity-freeing updates first
  const decreasing: RecordModel[] = [];
  const neutral: RecordModel[] = [];
  const positive: RecordModel[] = [];

  for (const rec of dirty) {
    if (!rec.serverId) {
      positive.push(rec);
    } else if (rec.status === 'consumed' || rec.status === 'discarded') {
      decreasing.push(rec);
    } else {
      neutral.push(rec);
    }
  }

  const orderedDirty = [...decreasing, ...neutral, ...positive];

  for (const rec of orderedDirty) {
    if (!isSyncEpochValid(runEpoch)) return;
    try {
      const clientId = rec.clientId || uuidv4();
      if (!rec.serverId) {
        // CREATE — POST /v1/records
        const body: Record<string, unknown> = {
          clientId,
          productId: rec.productId,
          customName: rec.customName,
          brand: rec.brand,
          expiryDate: rec.expiryDate,
          purchaseDate: rec.purchaseDate,
          quantity: rec.quantity,
          unit: rec.unit,
          notes: rec.notes,
          photoUrl: getWirePhotoUrl(rec.photoUrl),
          status: rec.status,
          consumedAt: rec.consumedAt ? rec.consumedAt.toISOString() : null,
          discardedAt: rec.discardedAt ? rec.discardedAt.toISOString() : null,
          discardReason: rec.discardReason ?? null,
        };
        if (rec.location) body.location = rec.location;
        if (rec.householdId) body.householdId = rec.householdId;
        const res = await apiClient.post<{ id: string }>(
          '/records',
          body,
          { headers: { 'Idempotency-Key': clientId } },
        );
        const remoteId = res.id;
        if (!isSyncEpochValid(runEpoch)) return;
        await database.write(async () => {
          if (!isSyncEpochValid(runEpoch)) return;
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete && isSyncEpochValid(runEpoch)) {
              await fresh.update((r) => {
                r.serverId = remoteId;
                r.clientId = clientId;
                r.pendingSync = false;
              });
            }
          } catch {
            // Model might have been destroyed locally during network await
          }
        });
        syncQuotaErrorsStore.remove(clientId);
      } else {
        // UPDATE — PATCH /v1/records/:id
        const patch: Record<string, unknown> = {
          customName: rec.customName,
          brand: rec.brand,
          expiryDate: rec.expiryDate,
          purchaseDate: rec.purchaseDate,
          quantity: rec.quantity,
          unit: rec.unit,
          notes: rec.notes,
          photoUrl: getWirePhotoUrl(rec.photoUrl),
          status: rec.status,
        };
        if (rec.householdId !== undefined) patch.householdId = rec.householdId;
        if (rec.consumedAt) patch.consumedAt = rec.consumedAt.toISOString();
        if (rec.discardedAt) patch.discardedAt = rec.discardedAt.toISOString();
        if (rec.discardReason !== undefined && rec.discardReason !== null) patch.discardReason = rec.discardReason;
        if (rec.locationDirty) patch.location = rec.location ? rec.location.trim() : null;

        await apiClient.patch(`/records/${rec.serverId}`, patch);
        if (!isSyncEpochValid(runEpoch)) return;
        await database.write(async () => {
          if (!isSyncEpochValid(runEpoch)) return;
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete && isSyncEpochValid(runEpoch)) {
              await fresh.update((r) => {
                if (r.status === patch.status) {
                  r.pendingSync = false;
                }
                if (patch.location !== undefined) {
                  r.locationDirty = false;
                }
              });
            }
          } catch {
            // Model might have been destroyed locally during network await
          }
        });
        syncQuotaErrorsStore.remove(rec.clientId);
      }
    } catch (err: unknown) {
      let status: number | undefined;
      let errorCode: string | undefined;
      if (isApiError(err)) {
        status = err.status;
        errorCode = err.code;
      } else if (err && typeof err === 'object') {
        const e = err as {
          status?: number;
          code?: string;
          response?: { status?: number; data?: { code?: string } };
          data?: { code?: string };
        };
        status = e.status ?? e.response?.status;
        errorCode = e.code ?? e.response?.data?.code ?? e.data?.code;
      }

      // Check for 409 item_limit_reached quota error (both POST create and PATCH restoration)
      if (status === 409 && (errorCode === ERROR_CODES.ITEM_LIMIT_REACHED || errorCode === 'item_limit_reached')) {
        syncQuotaErrorsStore.add(rec.clientId);
        // Do not throw; preserve pendingSync=true and continue loop
        continue;
      }

      if (rec.householdId && (status === 403 || status === 404)) {
        if (!isSyncEpochValid(runEpoch)) return;
        await database.write(async () => {
          if (!isSyncEpochValid(runEpoch)) return;
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete && isSyncEpochValid(runEpoch)) {
              await fresh.update((r) => {
                r.householdId = null;
                r.pendingSync = false;
              });
            }
          } catch {}
        });
      } else {
        throw err;
      }
    }
  }
}

async function applySyncChanges(
  changes: RecordSyncResponse['changes'],
  deletedIds: string[],
  conflicts: RecordSyncResponse['conflicts'],
  householdIds?: string[],
  runEpoch?: number,
): Promise<void> {
  if (!isSyncEpochValid(runEpoch)) return;
  const recordsCol = database.get<RecordModel>('records');

  await database.write(async () => {
    if (!isSyncEpochValid(runEpoch)) return;
    for (const c of conflicts ?? []) {
      if (c.reason === 'item_limit_reached') {
        syncQuotaErrorsStore.add(c.clientId);
      }
    }

    // 1. Handle scope-change conflicts: force-overwrite local rows from the
    //    echoed server change so the client adopts the new householdId.
    const conflictClientIds = new Set((conflicts ?? []).map((c) => c.clientId));
    for (const ch of changes) {
      if (!isSyncEpochValid(runEpoch)) return;
      if (!conflictClientIds.has(ch.clientId)) continue;
      const existing = await recordsCol.query(Q.where('client_id', ch.clientId)).fetch();
      if (!isSyncEpochValid(runEpoch)) return;
      const hit = existing[0];
      if (hit) {
        if (!isSyncEpochValid(runEpoch)) return;
        await hit.update((r) => {
          r.serverId = ch.id;
          r.clientId = ch.clientId;
          r.householdId = ch.householdId;
          r.userId = ch.userId ?? null;
          r.productId = ch.productId;
          r.customName = ch.customName;
          r.brand = ch.brand ?? null;
          r.expiryDate = ch.expiryDate;
          r.purchaseDate = ch.purchaseDate;
          r.quantity = ch.quantity;
          r.unit = ch.unit;
          r.notes = ch.notes;
          r.photoUrl = ch.photoUrl;
          r.status = ch.status;
          r.consumedAt = ch.consumedAt ? new Date(ch.consumedAt) : null;
          r.discardedAt = ch.discardedAt ? new Date(ch.discardedAt) : null;
          r.discardReason = ch.discardReason ?? null;
          r.location = ch.location ?? null;
          r.locationDirty = false;
          r.notifyAtJson = JSON.stringify(ch.notifyAt);
          r.pendingSync = false;
          r.pendingDelete = false;
        });
      }
    }

    // 2. Apply incoming changes with split conflict policy
    for (const ch of changes) {
      if (!isSyncEpochValid(runEpoch)) return;
      if (conflictClientIds.has(ch.clientId)) continue;
      // Protect quota-rejected pending restores from being overwritten by older server state
      if (syncQuotaErrorsStore.has(ch.clientId)) continue;

      const existing = await recordsCol.query(Q.where('client_id', ch.clientId)).fetch();
      if (!isSyncEpochValid(runEpoch)) return;
      const hit = existing[0];

      if (ch.householdId) {
        if (hit) {
          if (!isSyncEpochValid(runEpoch)) return;
          await hit.update((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.userId = ch.userId ?? null;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.brand = ch.brand ?? null;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.consumedAt = ch.consumedAt ? new Date(ch.consumedAt) : null;
            r.discardedAt = ch.discardedAt ? new Date(ch.discardedAt) : null;
            r.discardReason = ch.discardReason ?? null;
            r.location = ch.location ?? null;
            r.locationDirty = false;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        } else {
          if (!isSyncEpochValid(runEpoch)) return;
          await recordsCol.create((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.userId = ch.userId ?? null;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.brand = ch.brand ?? null;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.consumedAt = ch.consumedAt ? new Date(ch.consumedAt) : null;
            r.discardedAt = ch.discardedAt ? new Date(ch.discardedAt) : null;
            r.discardReason = ch.discardReason ?? null;
            r.location = ch.location ?? null;
            r.locationDirty = false;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        }
      } else {
        if (hit) {
          if (hit.pendingSync) continue;
          if (!isSyncEpochValid(runEpoch)) return;
          await hit.update((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.userId = ch.userId ?? null;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.brand = ch.brand ?? null;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.consumedAt = ch.consumedAt ? new Date(ch.consumedAt) : null;
            r.discardedAt = ch.discardedAt ? new Date(ch.discardedAt) : null;
            r.discardReason = ch.discardReason ?? null;
            r.location = ch.location ?? null;
            r.locationDirty = false;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        } else {
          if (!isSyncEpochValid(runEpoch)) return;
          await recordsCol.create((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = null;
            r.userId = ch.userId ?? null;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.brand = ch.brand ?? null;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.consumedAt = ch.consumedAt ? new Date(ch.consumedAt) : null;
            r.discardedAt = ch.discardedAt ? new Date(ch.discardedAt) : null;
            r.discardReason = ch.discardReason ?? null;
            r.location = ch.location ?? null;
            r.locationDirty = false;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        }
      }
    }

    for (const id of deletedIds) {
      if (!isSyncEpochValid(runEpoch)) return;
      const existing = await recordsCol.query(Q.where('server_id', id)).fetch();
      if (!isSyncEpochValid(runEpoch)) return;
      for (const e of existing) {
        if (!isSyncEpochValid(runEpoch)) return;
        await e.destroyPermanently();
      }
    }

    if (householdIds && householdIds.length >= 0) {
      if (!isSyncEpochValid(runEpoch)) return;
      const accessibleHhIds = new Set(householdIds);
      const localHouseholdRecords = await recordsCol
        .query(Q.where('household_id', Q.notEq(null)))
        .fetch();
      if (!isSyncEpochValid(runEpoch)) return;
      for (const r of localHouseholdRecords) {
        if (!isSyncEpochValid(runEpoch)) return;
        if (r.householdId && !accessibleHhIds.has(r.householdId)) {
          await r.destroyPermanently();
        }
      }
    }
  });
}

async function pullSince(runEpoch: number): Promise<void> {
  if (!isSyncEpochValid(runEpoch)) return;
  const since = await loadLastSync();
  let cursor: { updatedAt: string; id: string } | null = null;
  let initialServerTime: string | null = null;
  let hasMore = true;

  while (hasMore) {
    if (!isSyncEpochValid(runEpoch)) return;
    const body: RecordSyncBatch = {
      since: cursor ? null : (since ? since.toISOString() : null),
      cursor,
      upserts: [],
      deletes: [],
    };
    const res = await apiClient.post<RecordSyncResponse>('/records/sync', body);
    if (!isSyncEpochValid(runEpoch)) return;
    if (!initialServerTime) {
      initialServerTime = res.serverTime;
    }
    await applySyncChanges(res.changes, res.deletedIds, res.conflicts, res.householdIds, runEpoch);
    if (!isSyncEpochValid(runEpoch)) return;

    if (
      res.hasMore &&
      (!res.nextCursor ||
        (cursor &&
          res.nextCursor.id === cursor.id &&
          res.nextCursor.updatedAt === cursor.updatedAt))
    ) {
      throw new Error('Sync protocol error: non-advancing cursor received');
    }

    cursor = res.nextCursor ?? null;
    hasMore = Boolean(res.hasMore && cursor);
  }

  if (!hasMore && initialServerTime) {
    if (!isSyncEpochValid(runEpoch)) return;
    await saveLastSync(new Date(initialServerTime));
  }
}

/**
 * Purge local WatermelonDB records belonging to one or more households the
 * device no longer has access to. Call after self-leave / member-remove /
 * household dissolve so stale shared rows do not linger on-device.
 */
export async function purgeHouseholdRecords(householdIds: string[]): Promise<void> {
  if (householdIds.length === 0) return;
  const recordsCol = database.get<RecordModel>('records');
  const toPurge = await recordsCol.query(
    Q.where('household_id', Q.oneOf(householdIds)),
  ).fetch();
  await database.write(async () => {
    for (const r of toPurge) {
      await r.destroyPermanently();
    }
  });
}

async function loadLastSync(): Promise<Date | null> {
  try {
    const recordsCol = database.get<RecordModel>('records');
    const localCount = await recordsCol.query(Q.where('pending_delete', false)).fetchCount();
    if (localCount === 0) {
      // Local database is empty (fresh install, post-logout reset, or wiped database).
      // Return null so pullSince triggers a full initial pull from the server.
      return null;
    }
  } catch {
    // If count query fails, fallback to stored cursor
  }
  const raw = await getItem(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}
async function saveLastSync(d: Date): Promise<void> {
  await setItem(LAST_SYNC_KEY, d.toISOString());
}
