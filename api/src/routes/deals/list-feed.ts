import type { FastifyInstance } from 'fastify';
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

    const orderBy =
      query.sort === 'new'
        ? [{ createdAt: 'desc' as const }]
        : [{ score: 'desc' as const }, { createdAt: 'desc' as const }];

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.deal.findMany({
      where: {
        status: 'visible',
        ...(viewerCountry !== null
          ? { OR: [{ country: viewerCountry }, { country: null }] }
          : {}),
      },
      orderBy,
      take: query.limit + 1,
      ...(cursor ? { skip: 1, cursor } : {}),
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });

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
