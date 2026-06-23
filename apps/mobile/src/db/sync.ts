import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from './index';
import { apiClient } from '../api/client';
import { getItem, setItem } from '../auth/secure-store';
import type { RecordSyncResponse, RecordSyncBatch } from '@expyrico/shared';

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

async function pushPending(): Promise<void> {
  const recordsCol = database.get<RecordModel>('records');
  const dirty = await recordsCol.query(Q.where('pending_sync', true)).fetch();
  const deletes = await recordsCol.query(Q.where('pending_delete', true)).fetch();

  for (const rec of dirty) {
    const clientId = rec.clientId || uuidv4();
    if (!rec.serverId) {
      // CREATE — POST /v1/records (includes householdId for M8)
      const body: Record<string, unknown> = {
        clientId,
        productId: rec.productId,
        customName: rec.customName,
        expiryDate: rec.expiryDate,
        purchaseDate: rec.purchaseDate,
        quantity: rec.quantity,
        unit: rec.unit,
        notes: rec.notes,
        photoUrl: rec.photoUrl,
      };
      if (rec.householdId) body.householdId = rec.householdId;
      const res = await apiClient.post<{ id: string }>(
        '/records',
        body,
        { headers: { 'Idempotency-Key': clientId } },
      );
      const remoteId = res.id;
      await database.write(async () => {
        await rec.update((r) => {
          r.serverId = remoteId;
          r.clientId = clientId;
          r.pendingSync = false;
        });
      });
    } else {
      // UPDATE — PATCH /v1/records/:id
      const patch: Record<string, unknown> = {
        customName: rec.customName,
        expiryDate: rec.expiryDate,
        purchaseDate: rec.purchaseDate,
        quantity: rec.quantity,
        unit: rec.unit,
        notes: rec.notes,
        photoUrl: rec.photoUrl,
        status: rec.status,
      };
      if (rec.householdId !== undefined) patch.householdId = rec.householdId;
      await apiClient.patch(`/records/${rec.serverId}`, patch);
      await database.write(async () => {
        await rec.update((r) => {
          r.pendingSync = false;
        });
      });
    }
  }

  for (const rec of deletes) {
    if (rec.serverId) {
      await apiClient.delete(`/records/${rec.serverId}`);
    }
    await database.write(async () => {
      await rec.destroyPermanently();
    });
  }
}

async function pullSince(): Promise<void> {
  const since = await loadLastSync();
  const body: RecordSyncBatch = {
    since: since ? since.toISOString() : null,
    upserts: [],
    deletes: [],
  };
  const res = await apiClient.post<RecordSyncResponse>('/records/sync', body);
  const { changes, deletedIds, conflicts, serverTime } = res;
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
          r.productId = ch.productId;
          r.customName = ch.customName;
          r.expiryDate = ch.expiryDate;
          r.purchaseDate = ch.purchaseDate;
          r.quantity = ch.quantity;
          r.unit = ch.unit;
          r.notes = ch.notes;
          r.photoUrl = ch.photoUrl;
          r.status = ch.status;
          r.notifyAtJson = JSON.stringify(ch.notifyAt);
          r.pendingSync = false;
          r.pendingDelete = false;
        });
      }
    }

    // 2. Apply incoming changes with split conflict policy:
    //    - Household records (householdId != null): SERVER WINS — unconditional overwrite.
    //    - Personal records (householdId == null): keep M1 LWW merge (skip if local is newer,
    //      or just accept server since personal records sync via LWW on push).
    for (const ch of changes) {
      // Skip scope-change conflicts already handled above.
      if (conflictClientIds.has(ch.clientId)) continue;

      const existing = await recordsCol.query(Q.where('client_id', ch.clientId)).fetch();
      const hit = existing[0];

      if (ch.householdId) {
        // Household record — server-authoritative: unconditionally overwrite local.
        if (hit) {
          await hit.update((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        } else {
          // New household record the device hasn't seen → insert.
          await recordsCol.create((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        }
      } else {
        // Personal record — keep M1 merge: only apply if no local newer unsynced edit.
        if (hit) {
          // Skip if local has a newer pending edit (LWW: local will push on next cycle).
          if (hit.pendingSync) continue;
          await hit.update((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = ch.householdId;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
            r.notifyAtJson = JSON.stringify(ch.notifyAt);
            r.pendingSync = false;
            r.pendingDelete = false;
          });
        } else {
          await recordsCol.create((r) => {
            r.serverId = ch.id;
            r.clientId = ch.clientId;
            r.householdId = null;
            r.productId = ch.productId;
            r.customName = ch.customName;
            r.expiryDate = ch.expiryDate;
            r.purchaseDate = ch.purchaseDate;
            r.quantity = ch.quantity;
            r.unit = ch.unit;
            r.notes = ch.notes;
            r.photoUrl = ch.photoUrl;
            r.status = ch.status;
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
  });

  await saveLastSync(new Date(serverTime));
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
