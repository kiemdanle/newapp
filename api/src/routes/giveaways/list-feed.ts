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

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.giveaway.findMany({
      where: {
        status: query.status,
        ...(viewerCountry !== null
          ? { OR: [{ country: viewerCountry }, { country: null }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
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
