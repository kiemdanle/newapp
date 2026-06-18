import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { giveawayPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function updateGiveawayRoute(app: FastifyInstance) {
  app.patch('/giveaways/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = giveawayPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const existing = await prisma.giveaway.findUnique({ where: { id } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
    if (existing.giverUserId !== req.user!.id) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your giveaway' });
    if (existing.status !== 'open') throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_NOT_OPEN, title: 'Giveaway is not open' });
    const updated = await prisma.giveaway.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.locationText !== undefined ? { locationText: input.locationText } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      },
      include: {
        giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
        claims: true,
        _count: { select: { claims: true } },
      },
    });
    return toApiGiveaway(updated, { myClaim: null });
  });
}
