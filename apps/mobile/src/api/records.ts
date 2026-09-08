import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from '../db/index';
import { triggerSyncSoon } from '../db/triggers';
import { usePantryScope } from '../store/pantryScope';
import { apiClient } from './client';
import { runSync } from '../db/sync';

export interface LocalRecord {
  id: string; // watermelon id
  serverId: string | null;
  clientId: string;
  productId: string | null;
  customName: string | null;
  category: string | null;
  expiryDate: string;
  quantity: number;
  unit: string;
  price: number | null;
  store: string | null;
  notes: string | null;
  photoUrl: string | null;
  status: string;
  notifyAt: string[];
  householdId: string | null;
  userId?: string | null;
  consumedAt?: string | null;
  discardedAt?: string | null;
  discardReason?: string | null;
  location?: string | null;
}

function toLocal(r: RecordModel): LocalRecord {
  let notifyAt: string[] = [];
  try {
    notifyAt = JSON.parse(r.notifyAtJson) as string[];
  } catch {
    notifyAt = [];
  }
  return {
    id: r.id,
    serverId: r.serverId,
    clientId: r.clientId,
    productId: r.productId,
    customName: r.customName,
    category: r.category,
    expiryDate: r.expiryDate,
    quantity: r.quantity,
    unit: r.unit,
    price: r.price,
    store: r.store,
    notes: r.notes,
    photoUrl: r.photoUrl,
    status: r.status,
    notifyAt,
    householdId: r.householdId ?? null,
    userId: r.userId ?? null,
    consumedAt: r.consumedAt ? r.consumedAt.toISOString() : null,
    discardedAt: r.discardedAt ? r.discardedAt.toISOString() : null,
    discardReason: r.discardReason ?? null,
    location: r.location ?? null,
  };
}

export function useActiveRecords(): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const { scope, householdId } = usePantryScope();

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const conditions = [
      Q.where('status', 'active'),
      Q.where('pending_delete', false),
    ];
    // Scope filter: personal vs household
    if (scope === 'personal') {
      conditions.push(Q.where('household_id', null));
    } else if (scope === 'household' && householdId) {
      conditions.push(Q.where('household_id', householdId));
    }
    const sub = col
      .query(...conditions)
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));
    return () => sub.unsubscribe();
  }, [scope, householdId]);
  return rows;
}

export function useAllActiveRecords(): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const conditions = [
      Q.where('status', 'active'),
      Q.where('pending_delete', false),
    ];
    const sub = col
      .query(...conditions)
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));
    return () => sub.unsubscribe();
  }, []);
  return rows;
}

export function usePantryHistoryRecords(
  filter: 'all' | 'consumed' | 'discarded' = 'all',
): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const { scope, householdId } = usePantryScope();

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const statusCondition =
      filter === 'all'
        ? Q.where('status', Q.oneOf(['consumed', 'discarded']))
        : Q.where('status', filter);

    const conditions: any[] = [
      statusCondition,
      Q.where('pending_delete', false),
    ];

    if (scope === 'personal') {
      conditions.push(Q.where('household_id', null));
    } else if (scope === 'household' && householdId) {
      conditions.push(Q.where('household_id', householdId));
    }

    const sub = col
      .query(...conditions, Q.sortBy('updated_at', Q.desc))
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));

    return () => sub.unsubscribe();
  }, [filter, scope, householdId]);

  return rows;
}

export function useRecord(id: string | undefined): LocalRecord | null {
  const [row, setRow] = useState<LocalRecord | null>(null);
  useEffect(() => {
    if (!id) {
      setRow(null);
      return;
    }
    const col = database.get<RecordModel>('records');
    const sub = col.findAndObserve(id).subscribe(
      (r) => setRow(r ? toLocal(r) : null),
      () => setRow(null),
    );
    return () => sub.unsubscribe();
  }, [id]);
  return row;
}

export async function createLocalRecord(input: {
  productId?: string | null;
  customName?: string | null;
  category?: string | null;
  expiryDate: string;
  quantity: number;
  unit: string;
  price?: number | null;
  store?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  householdId?: string | null;
  userId?: string | null;
  location?: string | null;
}): Promise<string> {
  const clientId = uuidv4();
  const col = database.get<RecordModel>('records');
  let newId = '';
  await database.write(async () => {
    const created = await col.create((r) => {
      r.serverId = null;
      r.clientId = clientId;
      r.productId = input.productId ?? null;
      r.customName = input.customName ?? null;
      r.category = input.category ?? null;
      r.expiryDate = input.expiryDate;
      r.purchaseDate = null;
      r.quantity = input.quantity;
      r.unit = input.unit;
      r.price = input.price ?? null;
      r.store = input.store ?? null;
      r.notes = input.notes ?? null;
      r.photoUrl = input.photoUrl ?? null;
      r.status = 'active';
      r.notifyAtJson = '[]';
      r.consumedAt = null;
      r.pendingSync = true;
      r.pendingDelete = false;
      r.householdId = input.householdId ?? null;
      r.userId = input.userId ?? null;
      r.location = input.location ? input.location.trim().slice(0, 50) : null;
      r.locationDirty = Boolean(input.location);
    });
    newId = created.id;
  });
  triggerSyncSoon();
  return newId;
}

export async function patchLocalRecord(
  id: string,
  patch: Partial<
    Pick<LocalRecord, 'customName' | 'expiryDate' | 'quantity' | 'unit' | 'notes' | 'status' | 'photoUrl' | 'category' | 'productId' | 'householdId' | 'location'>
  >,
): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    await rec.update((r) => {
      if (patch.customName !== undefined) r.customName = patch.customName;
      if (patch.expiryDate !== undefined) r.expiryDate = patch.expiryDate;
      if (patch.quantity !== undefined) r.quantity = patch.quantity;
      if (patch.unit !== undefined) r.unit = patch.unit;
      if (patch.notes !== undefined) r.notes = patch.notes;
      if (patch.status !== undefined) r.status = patch.status;
      if (patch.photoUrl !== undefined) r.photoUrl = patch.photoUrl;
      if (patch.category !== undefined) r.category = patch.category;
      if (patch.productId !== undefined) r.productId = patch.productId;
      if (patch.householdId !== undefined) r.householdId = patch.householdId;
      if (patch.location !== undefined) {
        r.location = patch.location ? patch.location.trim().slice(0, 50) : null;
        r.locationDirty = true;
      }
      r.pendingSync = true;
    });
  });
  triggerSyncSoon();
}

export interface MarkRecordResult {
  affectedId: string;
  isSplit: boolean;
  parentId?: string | null;
  markedQuantity: number;
}

export async function markRecordStatusWithQuantity(
  id: string,
  status: 'consumed' | 'discarded',
  quantityToMark: number,
  discardReason: string | null = null,
): Promise<MarkRecordResult> {
  if (quantityToMark <= 0) {
    throw new Error('Quantity to mark must be greater than zero');
  }
  const cleanReason = discardReason ? discardReason.trim().slice(0, 50) : null;
  const col = database.get<RecordModel>('records');
  let affectedId = id;
  let isSplit = false;
  let parentId: string | null = null;
  await database.write(async () => {
    const rec = await col.find(id);
    if (quantityToMark >= rec.quantity) {
      // Full record transition
      await rec.update((r) => {
        r.status = status;
        if (status === 'consumed') {
          r.consumedAt = new Date();
          r.discardedAt = null;
          r.discardReason = null;
        } else {
          r.discardedAt = new Date();
          r.discardReason = cleanReason;
          r.consumedAt = null;
        }
        r.pendingSync = true;
      });
    } else {
      // Partial consumption: decrement active record, create history entry
      isSplit = true;
      parentId = rec.id;
      const originalQuantity = rec.quantity;
      const originalPrice = rec.price;
      const remaining = originalQuantity - quantityToMark;
      const splitPrice = originalPrice ? (originalPrice / originalQuantity) * quantityToMark : null;
      const remainingPrice = originalPrice ? (originalPrice / originalQuantity) * remaining : null;

      await rec.update((r) => {
        r.quantity = remaining;
        r.price = remainingPrice;
        r.pendingSync = true;
      });

      const historyRec = await col.create((r) => {
        r.clientId = uuidv4();
        r.productId = rec.productId;
        r.customName = rec.customName;
        r.category = rec.category;
        r.expiryDate = rec.expiryDate;
        r.purchaseDate = rec.purchaseDate;
        r.quantity = quantityToMark;
        r.unit = rec.unit;
        r.price = splitPrice;
        r.notes = rec.notes;
        r.photoUrl = rec.photoUrl;
        r.householdId = rec.householdId;
        r.userId = rec.userId;
        r.status = status;
        r.consumedAt = status === 'consumed' ? new Date() : null;
        r.discardedAt = status === 'discarded' ? new Date() : null;
        r.discardReason = cleanReason;
        r.location = rec.location ?? null;
        r.locationDirty = rec.locationDirty ?? null;
        r.notifyAtJson = '[]';
        r.pendingSync = true;
        r.pendingDelete = false;
      });
      affectedId = historyRec.id;
    }
  });

  triggerSyncSoon();
  return { affectedId, isSplit, parentId, markedQuantity: quantityToMark };
}

export interface RestoreRecordResult {
  restoredRecordId: string;
  wasReassignedToPersonal: boolean;
  mergedBackToParent: boolean;
}

export async function restoreLocalRecord(
  id: string,
  accessibleHouseholdIds: string[] = [],
  splitContext?: { isSplit?: boolean; parentId?: string | null; quantity?: number },
): Promise<RestoreRecordResult> {
  const col = database.get<RecordModel>('records');
  let wasReassignedToPersonal = false;
  let mergedBackToParent = false;
  let finalId = id;

  await database.write(async () => {
    const rec = await col.find(id);

    // If this was a partial-quantity split and the parent active record still exists,
    // merge quantity back into parent and delete the split record to avoid orphan splits.
    if (splitContext?.isSplit && splitContext?.parentId) {
      try {
        const parentRec = await col.find(splitContext.parentId);
        if (parentRec && parentRec.status === 'active' && !parentRec.pendingDelete) {
          await parentRec.update((p) => {
            p.quantity = p.quantity + (splitContext.quantity ?? rec.quantity);
            if (p.price != null && rec.price != null) {
              p.price = Number((p.price + rec.price).toFixed(2));
            }
            p.pendingSync = true;
          });
          await rec.destroyPermanently();
          mergedBackToParent = true;
          finalId = parentRec.id;
          return;
        }
      } catch {
        // Parent not found or error, fall back to standard restore
      }
    }

    let targetHouseholdId = rec.householdId;
    if (targetHouseholdId && accessibleHouseholdIds.length > 0 && !accessibleHouseholdIds.includes(targetHouseholdId)) {
      targetHouseholdId = null;
      wasReassignedToPersonal = true;
    }

    await rec.update((r) => {
      r.status = 'active';
      r.consumedAt = null;
      r.discardedAt = null;
      r.discardReason = null;
      r.householdId = targetHouseholdId;
      r.pendingSync = true;
    });
  });

  triggerSyncSoon();
  return { restoredRecordId: finalId, wasReassignedToPersonal, mergedBackToParent };
}

export async function deleteLocalRecord(id: string): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    await rec.update((r) => {
      r.pendingDelete = true;
    });
  });
  triggerSyncSoon();
}

export async function bulkPatchLocalRecordScope(
  recordIds: string[],
  targetHouseholdId: string | null,
): Promise<{ updatedCount: number; recordIds: string[] }> {
  const col = database.get<RecordModel>('records');
  let recs = await col.query(Q.where('id', Q.oneOf(recordIds))).fetch();

  // If any records are pending initial sync (no serverId yet), trigger sync first
  const hasUnsynced = recs.some((r) => !r.serverId);
  if (hasUnsynced) {
    try {
      await runSync();
      recs = await col.query(Q.where('id', Q.oneOf(recordIds))).fetch();
    } catch {
      // If sync fails, continue with whatever serverIds we have
    }
  }

  const serverRecordIds = recs
    .map((r) => r.serverId)
    .filter((id): id is string => Boolean(id));

  if (serverRecordIds.length === 0) {
    return { updatedCount: 0, recordIds: [] };
  }

  const response = await apiClient.post<{ updatedCount: number; recordIds: string[] }>(
    '/records/bulk-scope',
    {
      recordIds: serverRecordIds,
      targetHouseholdId,
    },
  );

  const updatedServerIdSet = new Set(response.recordIds);
  await database.write(async () => {
    for (const rec of recs) {
      if (rec.serverId && updatedServerIdSet.has(rec.serverId)) {
        await rec.update((r) => {
          r.householdId = targetHouseholdId;
          r.pendingSync = false;
        });
      }
    }
  });

  return response;
}
