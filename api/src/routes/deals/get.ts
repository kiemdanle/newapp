import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function getDealRoute(app: FastifyInstance) {
  app.get('/deals/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });
    if (!deal || (deal.status !== 'visible' && deal.userId !== viewerId)) {
      throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    }
    let myVote: -1 | 1 | null = null;
    if (viewerId) {
      const v = await prisma.dealVote.findUnique({
        where: { userId_dealId: { userId: viewerId, dealId: id } },
      });
      myVote = (v?.value as -1 | 1 | undefined) ?? null;
    }
    return toApiDeal(deal, { myVote });
  });
}
