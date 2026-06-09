import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function getGiveawayRoute(app: FastifyInstance) {
  app.get('/giveaways/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const viewerId = req.user?.id ?? null;
    const prisma = getPrisma();
    const g = await prisma.giveaway.findUnique({
      where: { id },
      include: {
        giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
        claims: true,
        _count: { select: { claims: true } },
      },
    });
    if (!g) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
    let myClaim = null;
    if (viewerId) {
      myClaim = await prisma.giveawayClaim.findUnique({
        where: { giveawayId_claimerUserId: { giveawayId: id, claimerUserId: viewerId } },
      });
    }
    return toApiGiveaway(g, { myClaim });
  });
}
