import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { claimCreateSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiClaim } from '../../services/giveaways/repository.js';
import { notifyNewClaim } from '../../notifications/giveaway-templates.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function claimsRoute(app: FastifyInstance) {
  app.post(
    '/giveaways/:id/claims',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const { id: giveawayId } = paramsSchema.parse(req.params);
      const input = claimCreateSchema.parse(req.body);
      const prisma = getPrisma();
      const userId = req.user!.id;

      const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
      if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
      if (giveaway.status !== 'open') throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_NOT_OPEN, title: 'Giveaway is not open' });
      if (giveaway.giverUserId === userId) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Cannot claim your own giveaway' });

      try {
        const claim = await prisma.giveawayClaim.create({
          data: { giveawayId, claimerUserId: userId, pickupNote: input.pickupNote ?? null },
          include: { claimer: { select: { id: true, firstName: true, avatarUrl: true, recipientRatingAvg: true, transactionCount: true } } },
        });
        await notifyNewClaim(giveaway.giverUserId, giveawayId, giveaway.title).catch(() => {});
        return reply.status(201).send(toApiClaim(claim, { revealNote: true }));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError({ status: 409, code: ERROR_CODES.CLAIM_ALREADY_EXISTS, title: 'Already claimed' });
        }
        throw err;
      }
    },
  );

  app.get('/giveaways/:id/claims', { onRequest: [app.requireAuth] }, async (req) => {
    const { id: giveawayId } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
    if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
    if (giveaway.giverUserId !== req.user!.id) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Only the giver can view claims' });
    const claims = await prisma.giveawayClaim.findMany({
      where: { giveawayId },
      orderBy: { createdAt: 'asc' },
      include: { claimer: { select: { id: true, firstName: true, avatarUrl: true, recipientRatingAvg: true, transactionCount: true } } },
    });
    return { items: claims.map((c) => toApiClaim(c, { revealNote: c.status === 'selected' })) };
  });
}
