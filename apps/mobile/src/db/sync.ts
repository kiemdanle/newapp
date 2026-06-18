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
      // CREATE — POST /v1/records
      const res = await apiClient.post<{ id: string }>(
        '/records',
        {
          clientId,
          productId: rec.productId,
          customName: rec.customName,
          expiryDate: rec.expiryDate,
          purchaseDate: rec.purchaseDate,
          quantity: rec.quantity,
          unit: rec.unit,
          notes: rec.notes,
          photoUrl: rec.photoUrl,
        },
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
      await apiClient.patch(`/records/${rec.serverId}`, {
        customName: rec.customName,
        expiryDate: rec.expiryDate,
        purchaseDate: rec.purchaseDate,
        quantity: rec.quantity,
        unit: rec.unit,
        notes: rec.notes,
        photoUrl: rec.photoUrl,
        status: rec.status,
      });
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
  const { changes, deletedIds, serverTime } = res;
  const recordsCol = database.get<RecordModel>('records');

  await database.write(async () => {
    for (const ch of changes) {
      const existing = await recordsCol.query(Q.where('server_id', ch.id)).fetch();
      const hit = existing[0];
      if (hit) {
        await hit.update((r) => {
          r.clientId = ch.clientId;
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
    for (const id of deletedIds) {
      const existing = await recordsCol.query(Q.where('server_id', id)).fetch();
      for (const e of existing) await e.destroyPermanently();
    }
  });

  await saveLastSync(new Date(serverTime));
}

async function loadLastSync(): Promise<Date | null> {
  const raw = await getItem(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}

async function saveLastSync(d: Date): Promise<void> {
  await setItem(LAST_SYNC_KEY, d.toISOString());
}
