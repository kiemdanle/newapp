import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminPantryItemDetailSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function adminPantryItemsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();

    const r = await prisma.record.findUnique({
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

    if (!r) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Pantry item not found',
      });
    }

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
