import {
  saveRecordLocalPhotos,
  getRecordLocalPhotosSync,
  removeRecordLocalPhotos,
  subscribeRecordPhotoStorage,
} from '../features/records/record-photo-storage';
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
  brand?: string | null;
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
  localPhotos?: string[] | null;
}

function toLocal(r: RecordModel): LocalRecord {
  let notifyAt: string[] = [];
  try {
    notifyAt = JSON.parse(r.notifyAtJson) as string[];
  } catch {
    notifyAt = [];
  }
  const localAttachments = getRecordLocalPhotosSync(r.clientId);
  const effectivePhotoUrl =
    localAttachments.length > 0
      ? localAttachments.length > 1
        ? JSON.stringify(localAttachments)
        : localAttachments[0]
      : r.photoUrl;

  return {
    id: r.id,
    serverId: r.serverId,
    clientId: r.clientId,
    productId: r.productId,
    customName: r.customName,
    brand: r.brand ?? null,
    category: r.category,
    expiryDate: r.expiryDate,
    quantity: r.quantity,
    unit: r.unit,
    price: r.price,
    store: r.store,
    notes: r.notes,
    photoUrl: effectivePhotoUrl ?? null,
    localPhotos: localAttachments,
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

export const RECORD_OBSERVED_COLUMNS = [
  'custom_name',
  'brand',
  'category',
  'expiry_date',
  'quantity',
  'unit',
  'location',
  'status',
  'notes',
  'photo_url',
  'price',
  'store',
  'household_id',
] as const;

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
    let currentModels: RecordModel[] = [];
    const sub = col
      .query(...conditions)
      .observeWithColumns(RECORD_OBSERVED_COLUMNS as unknown as string[])
      .subscribe((res) => {
        currentModels = res;
        setRows(res.map(toLocal));
      });
    const unsubStorage = subscribeRecordPhotoStorage(() => {
      if (currentModels.length > 0) {
        setRows(currentModels.map(toLocal));
      }
    });
    return () => {
      sub.unsubscribe();
      unsubStorage();
    };
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
    let currentModels: RecordModel[] = [];
    const sub = col
      .query(...conditions)
      .observeWithColumns(RECORD_OBSERVED_COLUMNS as unknown as string[])
      .subscribe((res) => {
        currentModels = res;
        setRows(res.map(toLocal));
      });
    const unsubStorage = subscribeRecordPhotoStorage(() => {
      if (currentModels.length > 0) {
        setRows(currentModels.map(toLocal));
      }
    });
    return () => {
      sub.unsubscribe();
      unsubStorage();
    };
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

    let currentModels: RecordModel[] = [];
    const sub = col
      .query(...conditions, Q.sortBy('updated_at', Q.desc))
      .observeWithColumns(RECORD_OBSERVED_COLUMNS as unknown as string[])
      .subscribe((res) => {
        currentModels = res;
        setRows(res.map(toLocal));
      });
    const unsubStorage = subscribeRecordPhotoStorage(() => {
      if (currentModels.length > 0) {
        setRows(currentModels.map(toLocal));
      }
    });

    return () => {
      sub.unsubscribe();
      unsubStorage();
    };
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
    let currentModel: RecordModel | null = null;
    const sub = col.findAndObserve(id).subscribe(
      (r) => {
        currentModel = r;
        setRow(r ? toLocal(r) : null);
      },
      () => setRow(null),
    );
    const unsubStorage = subscribeRecordPhotoStorage(() => {
      if (currentModel) {
        setRow(toLocal(currentModel));
      }
    });
    return () => {
      sub.unsubscribe();
      unsubStorage();
    };
  }, [id]);
  return row;
}

export async function createLocalRecord(input: {
  productId?: string | null;
  customName?: string | null;
  brand?: string | null;
  category?: string | null;
  expiryDate: string;
  quantity: number;
  unit: string;
  price?: number | null;
  store?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  localPhotos?: string[] | null;
  householdId?: string | null;
  userId?: string | null;
  location?: string | null;
}): Promise<string> {
  const clientId = uuidv4();
  let serverPhotoUrl: string | null = null;
  const localPhotoPaths: string[] = [];

  if (input.localPhotos && input.localPhotos.length > 0) {
    localPhotoPaths.push(...input.localPhotos);
  }

  if (input.photoUrl) {
    const raw = input.photoUrl.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      serverPhotoUrl = raw;
    } else if (!input.localPhotos) {
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string') {
                if (item.startsWith('http://') || item.startsWith('https://')) {
                  if (!serverPhotoUrl) serverPhotoUrl = item;
                } else {
                  localPhotoPaths.push(item);
                }
              }
            }
          }
        } catch {
          localPhotoPaths.push(raw);
        }
      } else {
        localPhotoPaths.push(raw);
      }
    }
  }

  if (localPhotoPaths.length > 0) {
    await saveRecordLocalPhotos(clientId, localPhotoPaths);
  }

  const col = database.get<RecordModel>('records');
  let newId = '';
  await database.write(async () => {
    const created = await col.create((r) => {
      r.serverId = null;
      r.clientId = clientId;
      r.productId = input.productId ?? null;
      r.customName = input.customName ?? null;
      r.brand = input.brand ? input.brand.trim().slice(0, 120) : null;
      r.category = input.category ?? null;
      r.expiryDate = input.expiryDate;
      r.purchaseDate = null;
      r.quantity = input.quantity;
      r.unit = input.unit;
      r.price = input.price ?? null;
      r.store = input.store ?? null;
      r.notes = input.notes ?? null;
      r.photoUrl = serverPhotoUrl;
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
    Pick<LocalRecord, 'customName' | 'brand' | 'expiryDate' | 'quantity' | 'unit' | 'notes' | 'status' | 'photoUrl' | 'category' | 'productId' | 'householdId' | 'location'>
  > & { localPhotos?: string[] | null },
): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    let serverPhotoUrl: string | null | undefined = patch.photoUrl;
    const localPhotoPaths: string[] = [];

    if (patch.localPhotos !== undefined) {
      if (patch.localPhotos && patch.localPhotos.length > 0) {
        localPhotoPaths.push(...patch.localPhotos);
      }
      await saveRecordLocalPhotos(rec.clientId, localPhotoPaths);
    } else if (patch.photoUrl !== undefined) {
      if (!patch.photoUrl) {
        await removeRecordLocalPhotos(rec.clientId);
        serverPhotoUrl = null;
      } else {
        const raw = patch.photoUrl.trim();
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
          serverPhotoUrl = raw;
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (typeof item === 'string') {
                  if (item.startsWith('http://') || item.startsWith('https://')) {
                    if (!serverPhotoUrl) serverPhotoUrl = item;
                  } else {
                    localPhotoPaths.push(item);
                  }
                }
              }
            }
          } catch {
            localPhotoPaths.push(raw);
          }
          await saveRecordLocalPhotos(rec.clientId, localPhotoPaths);
          serverPhotoUrl = serverPhotoUrl && (serverPhotoUrl.startsWith('http://') || serverPhotoUrl.startsWith('https://')) ? serverPhotoUrl : null;
        } else {
          localPhotoPaths.push(raw);
          await saveRecordLocalPhotos(rec.clientId, localPhotoPaths);
          serverPhotoUrl = null;
        }
      }
    }

    await rec.update((r) => {
      if (patch.customName !== undefined) r.customName = patch.customName;
      if (patch.brand !== undefined) r.brand = patch.brand ? patch.brand.trim().slice(0, 120) : null;
      if (patch.expiryDate !== undefined) r.expiryDate = patch.expiryDate;
      if (patch.quantity !== undefined) r.quantity = patch.quantity;
      if (patch.unit !== undefined) r.unit = patch.unit;
      if (patch.notes !== undefined) r.notes = patch.notes;
      if (patch.status !== undefined) r.status = patch.status;
      if (serverPhotoUrl !== undefined) r.photoUrl = serverPhotoUrl;
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

      const historyClientId = uuidv4();
      const sourcePhotos = getRecordLocalPhotosSync(rec.clientId);
      if (sourcePhotos.length > 0) {
        await saveRecordLocalPhotos(historyClientId, sourcePhotos);
      }

      const historyRec = await col.create((r) => {
        r.clientId = historyClientId;
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
          await removeRecordLocalPhotos(rec.clientId);
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
    await removeRecordLocalPhotos(rec.clientId);
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
