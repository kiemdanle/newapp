import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  adminPantryItemPatchSchema,
  adminPantryItemDetailSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { writeAuditLog } from '../../../services/audit/log.js';
import {
  lockUserPantryQuota,
  assertCanAddPantryItems,
} from '../../../services/records/pantry-limits.js';
import {
  computeNotifyAt,
  resolveOffsetsForUser,
} from '../../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../../queues/index.js';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function adminPantryItemsPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminPantryItemPatchSchema.parse(req.body);
    const prisma = getPrisma();

    const { needsReschedule } = await prisma.$transaction(async (tx) => {
      const existing = await tx.record.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, notificationPreferences: true } },
        },
      });

      if (!existing) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Pantry item not found',
        });
      }

      // Acquire shared serialization lock on owner
      await lockUserPantryQuota(tx, existing.userId);

      // Re-read fresh record under lock
      const fresh = await tx.record.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, notificationPreferences: true } },
        },
      });

      if (!fresh) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Pantry item not found',
        });
      }

      const data: Prisma.RecordUpdateInput = {};
      let shouldReschedule = false;

      if (input.customName !== undefined) data.customName = input.customName;
      if (input.brand !== undefined) data.brand = input.brand;
      if (input.category !== undefined) data.category = input.category;
      if (input.location !== undefined) data.location = input.location;
      if (input.quantity !== undefined) data.quantity = input.quantity;
      if (input.unit !== undefined) data.unit = input.unit;
      if (input.store !== undefined) data.store = input.store;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.price !== undefined) data.price = input.price;
      if (input.purchaseDate !== undefined) {
        data.purchaseDate = input.purchaseDate
          ? new Date(input.purchaseDate)
          : null;
      }

      let effectiveExpiryDate = fresh.expiryDate;
      if (input.expiryDate !== undefined) {
        effectiveExpiryDate = new Date(input.expiryDate);
        data.expiryDate = effectiveExpiryDate;
      }

      const newStatus = input.status ?? fresh.status;
      const isBecomingActive =
        newStatus === 'active' && fresh.status !== 'active';

      if (isBecomingActive) {
        // Enforce quota capacity upon reactivation
        await assertCanAddPantryItems(fresh.userId, 1, tx);
        data.status = 'active';
        data.consumedAt = null;
        data.discardedAt = null;
        data.discardReason = null;
        const userOffsets = resolveOffsetsForUser(
          fresh.user.notificationPreferences,
        );
        data.notifyAt = computeNotifyAt(effectiveExpiryDate, userOffsets);
        shouldReschedule = true;
      } else if (newStatus === 'consumed') {
        data.status = 'consumed';
        data.consumedAt = fresh.consumedAt ?? new Date();
        data.discardedAt = null;
        data.discardReason = null;
        data.notifyAt = [];
      } else if (newStatus === 'discarded') {
        data.status = 'discarded';
        data.discardedAt = fresh.discardedAt ?? new Date();
        data.discardReason = input.discardReason ?? fresh.discardReason ?? null;
        data.consumedAt = null;
        data.notifyAt = [];
      } else if (newStatus === 'expired') {
        data.status = 'expired';
        data.notifyAt = [];
      } else if (input.expiryDate !== undefined && fresh.status === 'active') {
        const userOffsets = resolveOffsetsForUser(
          fresh.user.notificationPreferences,
        );
        data.notifyAt = computeNotifyAt(effectiveExpiryDate, userOffsets);
        shouldReschedule = true;
      }

      if (input.discardReason !== undefined && newStatus === 'discarded') {
        data.discardReason = input.discardReason;
      }

      const updated = await tx.record.update({
        where: { id },
        data,
      });

      // Write audit log atomically inside the transaction!
      await writeAuditLog(
        {
          adminId: req.user!.id,
          action: 'pantry_item.update',
          targetType: 'record',
          targetId: id,
          diff: {
            before: fresh as unknown as Record<string, unknown>,
            after: updated as unknown as Record<string, unknown>,
          },
          requestId: req.id,
          ip: req.ip,
        },
        tx,
      );

      return { needsReschedule: shouldReschedule };
    });

    if (needsReschedule) {
      try {
        await notificationScheduleQueue().add(
          'schedule',
          { recordId: id },
          {
            jobId: `schedule__${id}`,
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      } catch {
        // Safe post-commit queue enqueue
      }
    }

    // Fetch and return the updated full detail
    const r = await prisma.record.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            country: true,
            status: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            barcode: true,
            imageUrl: true,
            status: true,
            version: true,
          },
        },
        household: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        _count: {
          select: {
            pushLogs: true,
            giveaways: true,
          },
        },
      },
    });

    const displayName = r.customName || r.product?.name || 'Untitled item';
    const userName =
      `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || '—';
    const photoUrlsList = Array.isArray(r.photoUrls)
      ? (r.photoUrls as string[])
      : [];
    const photoCount = photoUrlsList.length || (r.photoUrl ? 1 : 0);
    const notifyAtList = Array.isArray(r.notifyAt)
      ? (r.notifyAt as string[])
      : [];

    return adminPantryItemDetailSchema.parse({
      id: r.id,
      userId: r.userId,
      userName,
      userEmail: r.user.email,
      productId: r.productId,
      productName: r.product?.name ?? null,
      productBarcode: r.product?.barcode ?? null,
      customName: r.customName,
      displayName,
      brand: r.brand || r.product?.brand || null,
      category: r.category || r.product?.category || null,
      expiryDate: r.expiryDate.toISOString().slice(0, 10),
      purchaseDate: r.purchaseDate
        ? r.purchaseDate.toISOString().slice(0, 10)
        : null,
      quantity: Number(r.quantity),
      unit: r.unit,
      price: r.price !== null ? Number(r.price) : null,
      store: r.store,
      location: r.location,
      status: r.status,
      photoUrl: r.photoUrl ?? photoUrlsList[0] ?? null,
      photoCount,
      householdId: r.householdId,
      householdName: r.household?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      notes: r.notes,
      photoUrls: photoUrlsList,
      notifyAt: notifyAtList,
      consumedAt: r.consumedAt ? r.consumedAt.toISOString() : null,
      discardedAt: r.discardedAt ? r.discardedAt.toISOString() : null,
      discardReason: r.discardReason,
      user: {
        id: r.user.id,
        email: r.user.email,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        country: r.user.country,
        status: r.user.status,
      },
      product: r.product
        ? {
            id: r.product.id,
            name: r.product.name,
            brand: r.product.brand,
            category: r.product.category,
            barcode: r.product.barcode,
            imageUrl: r.product.imageUrl,
            status: r.product.status,
            version: r.product.version,
          }
        : null,
      household: r.household
        ? {
            id: r.household.id,
            name: r.household.name,
            memberCount: r.household._count.members,
          }
        : null,
      pushLogsCount: r._count.pushLogs,
      giveawaysCount: r._count.giveaways,
    });
  });
}
