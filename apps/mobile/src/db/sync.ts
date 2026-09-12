import { removeRecordLocalPhotos } from '../features/records/record-photo-storage';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from './index';
import { apiClient } from '../api/client';
import { getItem, setItem } from '../auth/secure-store';
import { ERROR_CODES, type RecordSyncResponse, type RecordSyncBatch } from '@expyrico/shared';
import { syncQuotaErrorsStore } from '../store/syncQuotaErrorsStore';

const LAST_SYNC_KEY = 'pantry.lastSyncAt';

let syncing = false;

export async function runSync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await pushPending();
    await pullSince();
  } finally {
    syncing = false;
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


async function pushPending(): Promise<void> {
  const recordsCol = database.get<RecordModel>('records');

  // STEP 1: Process deletes first
  const deletes = await recordsCol.query(Q.where('pending_delete', true)).fetch();
  for (const rec of deletes) {
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
    await database.write(async () => {
      await removeRecordLocalPhotos(rec.clientId);
      await rec.destroyPermanently();
    });
    syncQuotaErrorsStore.remove(rec.clientId);
  }

  // STEP 2: Query surviving dirty records (pending_delete == false)
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
        await database.write(async () => {
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete) {
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
        await database.write(async () => {
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete) {
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
      if (err && typeof err === 'object') {
        const e = err as { status?: number; response?: { status?: number; data?: { code?: string } }; data?: { code?: string } };
        status = e.status ?? e.response?.status;
        errorCode = e.response?.data?.code ?? e.data?.code;
      }

      // Check for 409 item_limit_reached quota error (both POST create and PATCH restoration)
      if (status === 409 && (errorCode === ERROR_CODES.ITEM_LIMIT_REACHED || errorCode === 'item_limit_reached')) {
        syncQuotaErrorsStore.add(rec.clientId);
        // Do not throw; preserve pendingSync=true and continue loop
        continue;
      }

      if (rec.householdId && (status === 403 || status === 404)) {
        await database.write(async () => {
          try {
            const fresh = await recordsCol.find(rec.id);
            if (fresh && !fresh.pendingDelete) {
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
): Promise<void> {
  const recordsCol = database.get<RecordModel>('records');

  await database.write(async () => {
    // 1. Handle scope-change conflicts: force-overwrite local rows from the
    //    echoed server change so the client adopts the new householdId.
    const conflictClientIds = new Set((conflicts ?? []).map((c) => c.clientId));
    for (const ch of changes) {
      if (!conflictClientIds.has(ch.clientId)) continue;
      const existing = await recordsCol.query(Q.where('client_id', ch.clientId)).fetch();
      const hit = existing[0];
      if (hit) {
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
      if (conflictClientIds.has(ch.clientId)) continue;
      // Protect quota-rejected pending restores from being overwritten by older server state
      if (syncQuotaErrorsStore.has(ch.clientId)) continue;

      const existing = await recordsCol.query(Q.where('client_id', ch.clientId)).fetch();
      const hit = existing[0];

      if (ch.householdId) {
        if (hit) {
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
      const existing = await recordsCol.query(Q.where('server_id', id)).fetch();
      for (const e of existing) await e.destroyPermanently();
    }

    if (householdIds && householdIds.length >= 0) {
      const accessibleHhIds = new Set(householdIds);
      const localHouseholdRecords = await recordsCol
        .query(Q.where('household_id', Q.notEq(null)))
        .fetch();
      for (const r of localHouseholdRecords) {
        if (r.householdId && !accessibleHhIds.has(r.householdId)) {
          await r.destroyPermanently();
        }
      }
    }
  });
}

async function pullSince(): Promise<void> {
  const since = await loadLastSync();
  let cursor: { updatedAt: string; id: string } | null = null;
  let initialServerTime: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const body: RecordSyncBatch = {
      since: cursor ? null : (since ? since.toISOString() : null),
      cursor,
      upserts: [],
      deletes: [],
    };
    const res = await apiClient.post<RecordSyncResponse>('/records/sync', body);
    if (!initialServerTime) {
      initialServerTime = res.serverTime;
    }
    await applySyncChanges(res.changes, res.deletedIds, res.conflicts, res.householdIds);

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
  const raw = await getItem(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}

async function saveLastSync(d: Date): Promise<void> {
  await setItem(LAST_SYNC_KEY, d.toISOString());
}
