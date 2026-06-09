import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertTransition } from '../../services/giveaways/state-machine.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function cancelGiveawayRoute(app: FastifyInstance) {
  app.post('/giveaways/:id/cancel', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const existing = await prisma.giveaway.findUnique({ where: { id }, include: { claims: true } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
    if (existing.giverUserId !== req.user!.id) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your giveaway' });
    assertTransition(existing.status, 'cancelled');
    const updated = await prisma.giveaway.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
        claims: true,
        _count: { select: { claims: true } },
      },
    });
    return toApiGiveaway(updated, { myClaim: null });
  });
}
