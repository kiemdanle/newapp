import type { FastifyInstance } from 'fastify';
import { giveawayListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

export async function listGiveawaysRoute(app: FastifyInstance) {
  app.get('/giveaways', async (req) => {
    const query = giveawayListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    let viewerCountry: string | null = null;
    if (viewerId) {
      const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { country: true } });
      viewerCountry = viewer?.country ?? null;
    }

    const whereConditions: Array<Record<string, unknown>> = [];

    if (query.status !== 'all') {
      whereConditions.push({ status: query.status });
    }

    if (query.q) {
      whereConditions.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { locationText: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.location) {
      whereConditions.push({
        locationText: { contains: query.location, mode: 'insensitive' },
      });
    }

    if (query.hasPhoto === true) {
      whereConditions.push({ photoUrl: { not: null } });
    }

    if (query.country) {
      if (query.country.toUpperCase() !== 'ALL') {
        whereConditions.push({ country: query.country.toUpperCase() });
      }
    } else if (viewerCountry !== null) {
      whereConditions.push({
        OR: [{ country: viewerCountry }, { country: null }],
      });
    }

    let orderBy: Array<Record<string, unknown>> = [{ createdAt: 'desc' }];
    switch (query.sort) {
      case 'old':
        orderBy = [{ createdAt: 'asc' }];
        break;
      case 'claims_desc':
        orderBy = [{ claims: { _count: 'desc' } }, { createdAt: 'desc' }];
        break;
      case 'claims_asc':
        orderBy = [{ claims: { _count: 'asc' } }, { createdAt: 'desc' }];
        break;
      case 'expiry_asc':
        orderBy = [{ claimExpiresAt: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'new':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.giveaway.findMany({
      where: whereConditions.length > 0 ? { AND: whereConditions } : {},
      orderBy: orderBy as never,
      take: query.limit + 1,
      ...(cursor ? { skip: 1, cursor } : {}),
      include: {
        giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
        claims: true,
        _count: { select: { claims: true } },
      },
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    let myClaims = new Map<string, typeof items[0]['claims'][0]>();
    if (viewerId && page.length > 0) {
      const myClaimRows = await prisma.giveawayClaim.findMany({
        where: { claimerUserId: viewerId, giveawayId: { in: page.map((g) => g.id) } },
      });
      myClaims = new Map(myClaimRows.map((c) => [c.giveawayId, c]));
    }

    return {
      items: page.map((g) => toApiGiveaway(g, { myClaim: myClaims.get(g.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
