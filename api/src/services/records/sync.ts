import { Prisma } from '@prisma/client';
import type { Record as PrismaRecord } from '@prisma/client';
import { ERROR_CODES, type RecordSyncBatch, type RecordSyncConflict } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { computeNotifyAt, resolveOffsetsForUser } from './notify-at.js';
import { maybeActivateReferral } from '../referrals/referral-service.js';
import { myHouseholdIds, lockHouseholdRow } from '../households/permissions.js';
import { assertProductUse, ProductUseRejectionError } from '../products/product-visibility.js';
import { lockUserPantryQuota, assertCanAddPantryItems } from './pantry-limits.js';
import { getPhotoLimits } from '../admin/settings.js';

export interface SyncOutcome {
  changes: PrismaRecord[];
  deletedIds: string[];
  conflicts: RecordSyncConflict[];
  serverTime: Date;
  householdIds: string[];
  nextCursor?: { updatedAt: string; id: string } | null;
  hasMore?: boolean;
}

export async function syncRecords(
  userId: string,
  batch: RecordSyncBatch,
): Promise<SyncOutcome> {
  const prisma = getPrisma();
  const serverTime = new Date();
  const deletedIds: string[] = [];
  const conflicts: RecordSyncConflict[] = [];
  const scheduledRecordIds: string[] = [];

  // Resolve the user's CURRENT household memberships ONCE at request time.
  // This set is used for both upsert authorization AND delta re-filtering.
  const householdIds = new Set(await myHouseholdIds(userId));

  // Resolve the user's default notification offsets once for the whole batch.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const userOffsets = resolveOffsetsForUser(user?.notificationPreferences);
  if (batch.upserts.some((record) => record.photoUrls?.length)) {
    const { maxPantryItemPhotos } = await getPhotoLimits();
    if (batch.upserts.some((record) => (record.photoUrls?.length ?? 0) > maxPantryItemPhotos)) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'Cannot exceed maximum of ' + maxPantryItemPhotos + ' photos',
      });
    }
  }

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

    // -- Pre-check: foreign client_id owned by another user → skip.
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

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Quota lock on the creator
          await lockUserPantryQuota(tx, userId);
          // 2. Household lock second
          await lockHouseholdRow(tx, recordHouseholdId);

          const tombstone = await tx.recordTombstone.findUnique({
            where: { clientId: u.clientId },
          });
          if (tombstone) {
            if (
              tombstone.userId === userId ||
              (tombstone.householdId && householdIds.has(tombstone.householdId))
            ) {
              deletedIds.push(tombstone.recordId);
            }
            return;
          }

          if (existing) {
            // Server row already exists — server wins; do NOT overwrite with client data.
            // The server copy will be echoed in the delta (step 3).
            return;
          }

          // Brand-new offline-created household record — this is always a new
          // attachment in household scope, never a preserved reference.
          if (u.productId) {
            await assertProductUse(userId, u.productId, { purpose: 'household_record' }, tx);
          }

          const uStatus = u.status ?? 'active';
          if (uStatus === 'active') {
            await assertCanAddPantryItems(userId, 1, tx);
          }

          const offsets = u.notificationOffsetsDays ?? userOffsets;
          const notifyAt = uStatus === 'active' ? computeNotifyAt(new Date(u.expiryDate), offsets) : [];
          let photoUrlsData: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined = undefined;
          let photoUrlData: string | null = u.photoUrl ?? null;
          if (u.photoUrls !== undefined) {
            if (u.photoUrls === null) {
              photoUrlsData = Prisma.DbNull;
              photoUrlData = null;
            } else {
              photoUrlsData = u.photoUrls;
              photoUrlData = u.photoUrls[0] ?? null;
            }
          }
          const created = await tx.record.create({
            data: {
              userId,
              clientId: u.clientId,
              householdId: recordHouseholdId,
              productId: u.productId ?? null,
              customName: u.customName ?? null,
              brand: u.brand ?? null,
              expiryDate: new Date(u.expiryDate),
              purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
              quantity: u.quantity,
              unit: u.unit,
              notes: u.notes ?? null,
              photoUrl: photoUrlData,
              photoUrls: photoUrlsData ?? Prisma.DbNull,
              status: uStatus,
              consumedAt: uStatus === 'consumed' ? (u.consumedAt ? new Date(u.consumedAt) : new Date()) : null,
              discardedAt: uStatus === 'discarded' ? (u.discardedAt ? new Date(u.discardedAt) : new Date()) : null,
              discardReason: uStatus === 'discarded' ? (u.discardReason || 'other') : null,
              notifyAt,
              location: u.location ? u.location.trim() : null,
            },
          });
          if (uStatus === 'active') {
            scheduledRecordIds.push(created.id);
          }
        });
      } catch (err) {
        if (err instanceof AppError && err.code === ERROR_CODES.ITEM_LIMIT_REACHED) {
          conflicts.push({ clientId: u.clientId, reason: 'item_limit_reached' });
        } else if (err instanceof ProductUseRejectionError) {
          conflicts.push({ clientId: u.clientId, reason: 'product_unavailable' });
        } else {
          throw err;
        }
      }
    } else {
      // --- Personal path: last-write-wins ---
      if (existing && existing.updatedAt >= clientUpdatedAt) continue; // server is newer

      const uStatus = u.status ?? existing?.status ?? 'active';
      const offsets = u.notificationOffsetsDays ?? userOffsets;
      const notifyAt = uStatus === 'active' ? computeNotifyAt(new Date(u.expiryDate), offsets) : [];
      const existingRecordReference = existing?.productId === (u.productId ?? null) && existing?.productId != null;

      try {
        await prisma.$transaction(async (tx) => {
          const ownerId = existing?.userId ?? userId;
          await lockUserPantryQuota(tx, ownerId);

          const tombstone = await tx.recordTombstone.findUnique({
            where: { clientId: u.clientId },
          });
          if (tombstone) {
            if (
              tombstone.userId === userId ||
              (tombstone.householdId && householdIds.has(tombstone.householdId))
            ) {
              deletedIds.push(tombstone.recordId);
            }
            return;
          }

          const freshRecord = await tx.record.findUnique({ where: { clientId: u.clientId } });
          if (freshRecord) {
            if (freshRecord.userId !== userId) {
              return;
            }
            if (freshRecord.updatedAt >= clientUpdatedAt) {
              return;
            }
          }

          const isBecomingActive = uStatus === 'active' && freshRecord?.status !== 'active';
          if (isBecomingActive) {
            await assertCanAddPantryItems(ownerId, 1, tx);
          }

          if (u.productId) {
            await assertProductUse(
              userId,
              u.productId,
              { purpose: 'personal_record', existingRecordReference },
              tx,
            );
          }
          let photoUrlsData: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined = undefined;
          let photoUrlData: string | null = u.photoUrl ?? null;
          if (u.photoUrls !== undefined) {
            if (u.photoUrls === null) {
              photoUrlsData = Prisma.DbNull;
              photoUrlData = null;
            } else {
              photoUrlsData = u.photoUrls;
              photoUrlData = u.photoUrls[0] ?? null;
            }
          }

          let photoUrlsUpdate: { photoUrls?: Prisma.InputJsonValue | typeof Prisma.DbNull } = {};
          let photoUrlUpdate: { photoUrl?: string | null } = {};
          if (u.photoUrls !== undefined) {
            if (u.photoUrls === null) {
              photoUrlsUpdate = { photoUrls: Prisma.DbNull };
              photoUrlUpdate = { photoUrl: null };
            } else {
              photoUrlsUpdate = { photoUrls: u.photoUrls };
              photoUrlUpdate = { photoUrl: u.photoUrls[0] ?? null };
            }
          } else if (u.photoUrl !== undefined) {
            photoUrlUpdate = { photoUrl: u.photoUrl };
          }
          const upserted = await tx.record.upsert({
            where: { clientId: u.clientId },
            create: {
              userId,
              clientId: u.clientId,
              productId: u.productId ?? null,
              customName: u.customName ?? null,
              brand: u.brand ?? null,
              expiryDate: new Date(u.expiryDate),
              purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
              quantity: u.quantity,
              unit: u.unit,
              notes: u.notes ?? null,
              photoUrl: photoUrlData,
              photoUrls: photoUrlsData ?? Prisma.DbNull,
              status: u.status ?? 'active',
              consumedAt: (u.status ?? 'active') === 'consumed' ? (u.consumedAt ? new Date(u.consumedAt) : new Date()) : null,
              discardedAt: (u.status ?? 'active') === 'discarded' ? (u.discardedAt ? new Date(u.discardedAt) : new Date()) : null,
              discardReason: (u.status ?? 'active') === 'discarded' ? (u.discardReason || 'other') : null,
              notifyAt,
              location: u.location ? u.location.trim() : null,
            },
            update: {
              productId: u.productId ?? null,
              customName: u.customName ?? null,
              brand: u.brand ?? null,
              expiryDate: new Date(u.expiryDate),
              purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
              quantity: u.quantity,
              unit: u.unit,
              notes: u.notes ?? null,
              ...photoUrlUpdate,
              ...photoUrlsUpdate,
              status: uStatus,
              consumedAt: uStatus === 'consumed' ? (u.consumedAt ? new Date(u.consumedAt) : (freshRecord?.consumedAt ?? new Date())) : null,
              discardedAt: uStatus === 'discarded' ? (u.discardedAt ? new Date(u.discardedAt) : (freshRecord?.discardedAt ?? new Date())) : null,
              discardReason: uStatus === 'discarded' ? (u.discardReason || freshRecord?.discardReason || 'other') : null,
              notifyAt,
              ...(u.location !== undefined ? { location: u.location ? u.location.trim() : null } : {}),
            },
          });
          if (uStatus === 'active') {
            scheduledRecordIds.push(upserted.id);
          }
        });
      } catch (err) {
        if (err instanceof AppError && err.code === ERROR_CODES.ITEM_LIMIT_REACHED) {
          conflicts.push({ clientId: u.clientId, reason: 'item_limit_reached' });
        } else if (err instanceof ProductUseRejectionError) {
          conflicts.push({ clientId: u.clientId, reason: 'product_unavailable' });
        } else {
          throw err;
        }
      }
    }
  }

  // After upserting, check referral activation.
  await maybeActivateReferral(userId).catch(() => {});

  // Enqueue notification schedule jobs for all synchronized records in one Redis transaction
  if (scheduledRecordIds.length > 0) {
    const scheduleQ = notificationScheduleQueue();
    const bulkJobs = scheduledRecordIds.map((recId) => ({
      name: 'schedule',
      data: { recordId: recId },
      opts: { jobId: `schedule__${recId}`, removeOnComplete: true, removeOnFail: 100 },
    }));
    await scheduleQ.addBulk(bulkJobs).catch(() => {});
  }

  // 3. Delta pull: return ALL records the caller can currently see, re-filtered
  //    by CURRENT visibility (resolved at request time), so a record that left a
  //    household since the last sync is NOT echoed to a former co-member.
  const sinceDate = batch.since ? new Date(batch.since) : new Date(0);
  const householdIdList = [...householdIds];

  const seekCondition = batch.cursor
    ? {
        OR: [
          { updatedAt: { gt: new Date(batch.cursor.updatedAt) } },
          {
            updatedAt: new Date(batch.cursor.updatedAt),
            id: { gt: batch.cursor.id },
          },
        ],
      }
    : { updatedAt: { gt: sinceDate } };

  const visibilityCondition = {
    OR: [
      // Personal records owned by caller.
      { userId, householdId: null },
      // Household records the caller can currently see (membership-scoped).
      ...(householdIdList.length > 0
        ? [{ householdId: { in: householdIdList } }]
        : []),
    ],
  };

  const takeLimit = 1000;
  const changes = await prisma.record.findMany({
    where: { AND: [seekCondition, visibilityCondition] },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: takeLimit + 1,
  });

  const hasMore = changes.length > takeLimit;
  if (hasMore) {
    changes.pop();
  }
  const lastItem = changes.length > 0 ? changes[changes.length - 1] : null;
  const nextCursor = hasMore && lastItem
    ? { updatedAt: lastItem.updatedAt.toISOString(), id: lastItem.id }
    : null;
  // 4. Tombstone pull: deliver server-side deletions since sinceDate
  // Only query on initial page (batch.cursor absent) to prevent unbounded replay on continuations
  if (!batch.cursor) {
    const tombstones = await prisma.recordTombstone.findMany({
      where: {
        deletedAt: { gt: sinceDate },
        OR: [
          { userId, householdId: null },
          ...(householdIdList.length > 0
            ? [{ householdId: { in: householdIdList } }]
            : []),
        ],
      },
      select: { recordId: true },
      take: 1000,
    });
    for (const t of tombstones) {
      deletedIds.push(t.recordId);
    }
  }

  const uniqueDeletedIds = Array.from(new Set(deletedIds));

  return {
    changes,
    deletedIds: uniqueDeletedIds,
    conflicts,
    serverTime,
    householdIds: householdIdList,
    nextCursor,
    hasMore,
  };
}
