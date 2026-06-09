import type { Record as PrismaRecord } from '@prisma/client';
import type { RecordSyncBatch } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { computeNotifyAt, resolveOffsetsForUser } from './notify-at.js';
import { maybeActivateReferral } from '../referrals/referral-service.js';

export interface SyncOutcome {
  changes: PrismaRecord[];
  deletedIds: string[];
  serverTime: Date;
}

export async function syncRecords(
  userId: string,
  batch: RecordSyncBatch,
): Promise<SyncOutcome> {
  const prisma = getPrisma();
  const serverTime = new Date();
  const deletedIds: string[] = [];

  // Resolve the user's default notification offsets once for the whole batch.
  // A per-upsert `notificationOffsetsDays` (when present) still wins below.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const userOffsets = resolveOffsetsForUser(user?.notificationPreferences);

  // 1. Apply deletes (only the caller's records)
  if (batch.deletes.length > 0) {
    const owned = await prisma.record.findMany({
      where: { id: { in: batch.deletes }, userId },
      select: { id: true },
    });
    const ownedIds = owned.map((r) => r.id);
    if (ownedIds.length > 0) {
      await prisma.record.deleteMany({ where: { id: { in: ownedIds } } });
      deletedIds.push(...ownedIds);
    }
  }

  // 2. Apply upserts with last-write-wins on (clientId, updatedAt)
  for (const u of batch.upserts) {
    const existing = await prisma.record.findUnique({ where: { clientId: u.clientId } });
    const clientUpdatedAt = new Date(u.updatedAt);
    if (existing && existing.userId !== userId) continue; // ignore foreign client_id
    if (existing && existing.updatedAt >= clientUpdatedAt) continue; // server is newer
    const offsets = u.notificationOffsetsDays ?? userOffsets;
    const notifyAt = computeNotifyAt(new Date(u.expiryDate), offsets);
    await prisma.record.upsert({
      where: { clientId: u.clientId },
      create: {
        userId,
        clientId: u.clientId,
        productId: u.productId ?? null,
        customName: u.customName ?? null,
        expiryDate: new Date(u.expiryDate),
        purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
        quantity: u.quantity,
        unit: u.unit,
        notes: u.notes ?? null,
        photoUrl: u.photoUrl ?? null,
        status: u.status ?? 'active',
        notifyAt,
      },
      update: {
        productId: u.productId ?? null,
        customName: u.customName ?? null,
        expiryDate: new Date(u.expiryDate),
        purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
        quantity: u.quantity,
        unit: u.unit,
        notes: u.notes ?? null,
        photoUrl: u.photoUrl ?? null,
        status: u.status ?? existing?.status ?? 'active',
        notifyAt,
      },
    });
  }

  // After upserting, check if the user's referral should be activated.
  // Passive activation: fires when the referred user reaches 5 lifetime records.
  await maybeActivateReferral(userId).catch(() => {});

  // 3. Return server-side changes since `since`
  const sinceDate = batch.since ? new Date(batch.since) : new Date(0);
  const changes = await prisma.record.findMany({
    where: { userId, updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: 'asc' },
    take: 1000,
  });

  return { changes, deletedIds, serverTime };
}
