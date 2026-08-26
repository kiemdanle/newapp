import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { dealListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiDeal } from '../../services/deals/repository.js';

export async function listFeedRoute(app: FastifyInstance) {
  app.get('/deals', async (req) => {
    const query = dealListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    let viewerCountry: string | null = null;
    if (viewerId) {
      const viewer = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { country: true },
      });
      viewerCountry = viewer?.country ?? null;
    }

    const andConditions: Prisma.DealWhereInput[] = [{ status: 'visible' }];

    if (query.productId) {
      andConditions.push({ productId: query.productId });
    }

    if (query.store) {
      andConditions.push({ storeName: { equals: query.store, mode: 'insensitive' } });
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
      if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
      andConditions.push({ price: priceFilter });
    }

    // Timezone-aware date boundary calculation
    const nowMs = Date.now();
    const offsetMs = (query.timezoneOffset ?? 0) * 60 * 1000;
    const clientLocalNow = new Date(nowMs - offsetMs);
    const todayStart = new Date(
      Date.UTC(
        clientLocalNow.getUTCFullYear(),
        clientLocalNow.getUTCMonth(),
        clientLocalNow.getUTCDate(),
      ),
    );

    if (query.expiryStatus === 'unexpired') {
      andConditions.push({
        OR: [{ expiryDate: { gte: todayStart } }, { expiryDate: null }],
      });
    } else if (query.expiryStatus === 'expiring_soon') {
      const next7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      andConditions.push({
        expiryDate: { gte: todayStart, lte: next7Days },
      });
    }

    if (query.q) {
      andConditions.push({
        OR: [
          { product: { name: { contains: query.q, mode: 'insensitive' } } },
          { product: { brand: { contains: query.q, mode: 'insensitive' } } },
          { storeName: { contains: query.q, mode: 'insensitive' } },
          { note: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    // Country scoping:
    // If explicitly provided:
    if (query.country) {
      if (query.country.toUpperCase() !== 'ALL') {
        andConditions.push({
          OR: [{ country: query.country.toUpperCase() }, { country: null }],
        });
      }
    } else if (viewerCountry !== null) {
      andConditions.push({
        OR: [{ country: viewerCountry }, { country: null }],
      });
    }

    const where: Prisma.DealWhereInput = { AND: andConditions };

    let orderBy: Prisma.DealOrderByWithRelationInput[];
    switch (query.sort) {
      case 'new':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'price_asc':
        orderBy = [{ price: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'price_desc':
        orderBy = [{ price: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'expiry_asc':
        orderBy = [{ expiryDate: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'score':
      default:
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }];
        break;
    }

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    let items = await prisma.deal.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      ...(cursor ? { skip: 1, cursor } : {}),
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });

    // Fallback: If scoped to viewerCountry (without explicit country filter/search) and 0 items found,
    // broaden search to global deals so feed is never completely empty for new regions.
    if (items.length === 0 && viewerCountry !== null && !query.country && !cursor && !query.q && !query.store) {
      const fallbackWhere: Prisma.DealWhereInput = {
        status: 'visible',
      };
      items = await prisma.deal.findMany({
        where: fallbackWhere,
        orderBy,
        take: query.limit + 1,
        include: {
          product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          user: { select: { id: true, firstName: true, avatarUrl: true } },
        },
      });
    }

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    let myVotes = new Map<string, -1 | 1>();
    if (viewerId && page.length > 0) {
      const votes = await prisma.dealVote.findMany({
        where: { userId: viewerId, dealId: { in: page.map((d) => d.id) } },
      });
      myVotes = new Map(votes.map((v) => [v.dealId, v.value as -1 | 1]));
    }

    return {
      items: page.map((d) => toApiDeal(d, { myVote: myVotes.get(d.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
