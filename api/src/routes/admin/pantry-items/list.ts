import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  adminPantryItemsQuerySchema,
  adminPantryItemsListSchema,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminPantryItemsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminPantryItemsQuerySchema.parse(req.query);
    const where: Prisma.RecordWhereInput = {};

    // 1. Keyword search across multiple fields
    if (q.q) {
      where.OR = [
        { customName: { contains: q.q, mode: 'insensitive' } },
        { product: { name: { contains: q.q, mode: 'insensitive' } } },
        { brand: { contains: q.q, mode: 'insensitive' } },
        { product: { brand: { contains: q.q, mode: 'insensitive' } } },
        { category: { contains: q.q, mode: 'insensitive' } },
        { product: { category: { contains: q.q, mode: 'insensitive' } } },
        { notes: { contains: q.q, mode: 'insensitive' } },
        { store: { contains: q.q, mode: 'insensitive' } },
        { user: { email: { contains: q.q, mode: 'insensitive' } } },
        { user: { firstName: { contains: q.q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q.q, mode: 'insensitive' } } },
        { product: { barcode: { equals: q.q } } },
      ];
    }

    // 2. Location filter
    if (q.location) {
      where.location = { equals: q.location, mode: 'insensitive' };
    }

    // 3. Category filter (checks both record.category and product.category)
    if (q.category) {
      const categoryFilter: Prisma.RecordWhereInput[] = [
        { category: { equals: q.category, mode: 'insensitive' } },
        { product: { category: { equals: q.category, mode: 'insensitive' } } },
      ];
      if (where.AND) {
        (where.AND as Prisma.RecordWhereInput[]).push({ OR: categoryFilter });
      } else {
        where.AND = [{ OR: categoryFilter }];
      }
    }

    // 4. Brand filter (checks both record.brand and product.brand)
    if (q.brand) {
      const brandFilter: Prisma.RecordWhereInput[] = [
        { brand: { equals: q.brand, mode: 'insensitive' } },
        { product: { brand: { equals: q.brand, mode: 'insensitive' } } },
      ];
      if (where.AND) {
        (where.AND as Prisma.RecordWhereInput[]).push({ OR: brandFilter });
      } else {
        where.AND = [{ OR: brandFilter }];
      }
    }

    // 5. Product filters
    if (q.productId) {
      where.productId = q.productId;
    } else if (q.productType === 'catalog') {
      where.productId = { not: null };
    } else if (q.productType === 'custom') {
      where.productId = null;
    }

    // 6. User filter
    if (q.userId) {
      where.userId = q.userId;
    }

    // 7. Status filter
    if (q.status && q.status !== 'all') {
      where.status = q.status;
    }

    // 8. Sorting
    let orderBy: Prisma.RecordOrderByWithRelationInput[];
    const order = q.sortOrder;

    switch (q.sortBy) {
      case 'createdAt':
        orderBy = [{ createdAt: order }, { id: 'desc' }];
        break;
      case 'updatedAt':
        orderBy = [{ updatedAt: order }, { id: 'desc' }];
        break;
      case 'quantity':
        orderBy = [{ quantity: order }, { id: 'desc' }];
        break;
      case 'name':
        orderBy = [{ customName: order }, { id: 'asc' }];
        break;
      case 'expiryDate':
      default:
        orderBy = [{ expiryDate: order }, { id: 'asc' }];
        break;
    }

    const prisma = getPrisma();
    const skip = (q.page - 1) * q.limit;
    const take = q.limit;

    const [rows, total] = await Promise.all([
      prisma.record.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              barcode: true,
              brand: true,
              category: true,
            },
          },
          household: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.record.count({ where }),
    ]);

    const items = rows.map((r) => {
      const displayName = r.customName || r.product?.name || 'Untitled item';
      const userName =
        `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || '—';
      const photoUrlsList = Array.isArray(r.photoUrls)
        ? (r.photoUrls as string[])
        : [];
      const photoCount = photoUrlsList.length || (r.photoUrl ? 1 : 0);

      return {
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
      };
    });

    const totalPages = Math.ceil(total / q.limit) || 1;

    return adminPantryItemsListSchema.parse({
      items,
      total,
      page: q.page,
      limit: q.limit,
      totalPages,
    });
  });
}
