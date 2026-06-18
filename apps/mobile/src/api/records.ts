import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from '../db/index';
import { triggerSyncSoon } from '../db/triggers';

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
  };
}

export function useActiveRecords(): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const sub = col
      .query(Q.where('status', 'active'), Q.where('pending_delete', false))
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));
    return () => sub.unsubscribe();
  }, []);
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
    });
    newId = created.id;
  });
  triggerSyncSoon();
  return newId;
}

export async function patchLocalRecord(
  id: string,
  patch: Partial<
    Pick<LocalRecord, 'customName' | 'expiryDate' | 'quantity' | 'unit' | 'notes' | 'status'>
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
      r.pendingSync = true;
    });
  });
  triggerSyncSoon();
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
