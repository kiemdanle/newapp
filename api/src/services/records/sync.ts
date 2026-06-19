import type { Record as PrismaRecord } from '@prisma/client';
import type { RecordSyncBatch, RecordSyncConflict } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { computeNotifyAt, resolveOffsetsForUser } from './notify-at.js';
import { maybeActivateReferral } from '../referrals/referral-service.js';
import { myHouseholdIds } from '../households/permissions.js';

export interface SyncOutcome {
  changes: PrismaRecord[];
  deletedIds: string[];
  conflicts: RecordSyncConflict[];
  serverTime: Date;
}

/**
 * Take an advisory lock on a household row so concurrent dissolve / member-remove
 * / record-write serialize on the same household. Released automatically at
 * transaction end (pg_advisory_xact_lock).
 */
async function lockHouseholdRow(tx: ReturnType<typeof getPrisma>, householdId: string): Promise<void> {
  const hex = householdId.replace(/-/g, '').slice(0, 15);
  const lockKey = parseInt(hex, 16);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

export async function syncRecords(
  userId: string,
  batch: RecordSyncBatch,
): Promise<SyncOutcome> {
  const prisma = getPrisma();
  const serverTime = new Date();
  const deletedIds: string[] = [];
  const conflicts: RecordSyncConflict[] = [];

  // Resolve the user's CURRENT household memberships ONCE at request time.
  // This set is used for both upsert authorization AND delta re-filtering.
  const householdIds = new Set(await myHouseholdIds(userId));

  // Resolve the user's default notification offsets once for the whole batch.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const userOffsets = resolveOffsetsForUser(user?.notificationPreferences);

  // 1. Apply deletes — caller's personal records + household records they can access.
  if (batch.deletes.length > 0) {
    const found = await prisma.record.findMany({
      where: { id: { in: batch.deletes } },
      select: { id: true, userId: true, householdId: true },
    });
    const allowedIds: string[] = [];
    for (const r of found) {
      if (r.householdId === null) {
        // Personal — only the owner.
        if (r.userId === userId) allowedIds.push(r.id);
      } else {
        // Household — any member.
        if (householdIds.has(r.householdId)) allowedIds.push(r.id);
      }
    }
    if (allowedIds.length > 0) {
      await prisma.record.deleteMany({ where: { id: { in: allowedIds } } });
      deletedIds.push(...allowedIds);
    }
  }

  // 2. Apply upserts with split conflict policy.
  for (const u of batch.upserts) {
    const existing = await prisma.record.findUnique({ where: { clientId: u.clientId } });
    const clientUpdatedAt = new Date(u.updatedAt);

    // -- Pre-check: foreign client_id owned by another user → skip (M1 rule).
    if (existing && existing.userId !== userId) continue;

    const clientBelievesScope: string | null = u.householdId ?? null;
    const serverScope: string | null = existing?.householdId ?? null;

    // -- Scope-change conflict: CHANGED on server since client last synced.
    if (existing && clientBelievesScope !== serverScope) {
      conflicts.push({ clientId: u.clientId, reason: 'scope_changed' });
      // The server row is authoritative; do NOT apply the client mutation.
      // The echoed delta (step 3) will include the canonical server row.
      continue;
    }

    // Determine the record's current household scope (both sides agree here).
    const recordHouseholdId: string | null = existing?.householdId ?? (u.householdId ?? null);

    if (recordHouseholdId) {
      // --- Household path: server-authoritative ---
      // Caller must be a current member of the relevant household.
      if (!householdIds.has(recordHouseholdId)) continue; // drop silently

      // Take the household-row lock so this upsert serializes against
      // concurrent dissolve / member-remove / other record writes.
      // We wrap the dependent work in a raw transaction for the lock + write.
      // For simplicity, we use the Prisma interactive transaction.
      await prisma.$transaction(async (tx) => {
        await lockHouseholdRow(tx as unknown as ReturnType<typeof getPrisma>, recordHouseholdId);

        if (existing) {
          // Server row already exists — server wins; do NOT overwrite with client data.
          // The server copy will be echoed in the delta (step 3).
          return;
        }

        // Brand-new offline-created household record — insert it.
        const offsets = u.notificationOffsetsDays ?? userOffsets;
        const notifyAt = computeNotifyAt(new Date(u.expiryDate), offsets);
        await tx.record.create({
          data: {
            userId,
            clientId: u.clientId,
            householdId: recordHouseholdId,
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
        });
      });
    } else {
      // --- Personal path: last-write-wins (M1 behavior verbatim) ---
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
  }

  // After upserting, check referral activation.
  await maybeActivateReferral(userId).catch(() => {});

  // 3. Delta pull: return ALL records the caller can currently see, re-filtered
  //    by CURRENT visibility (resolved at request time), so a record that left a
  //    household since the last sync is NOT echoed to a former co-member.
  const sinceDate = batch.since ? new Date(batch.since) : new Date(0);

  const householdIdList = [...householdIds];
  const changes = await prisma.record.findMany({
    where: {
      updatedAt: { gt: sinceDate },
      OR: [
        // Personal records owned by caller.
        { userId, householdId: null },
        // Household records the caller can currently see (membership-scoped).
        ...(householdIdList.length > 0
          ? [{ householdId: { in: householdIdList } }]
          : []),
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: 1000,
  });

  return { changes, deletedIds, conflicts, serverTime };
}
