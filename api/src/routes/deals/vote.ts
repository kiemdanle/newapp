import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, dealVoteSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { recomputeDealScore } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const voteRateLimit = { max: 30, timeWindow: '1 minute' } as const;

export async function dealVoteRoutes(app: FastifyInstance) {
  app.post(
    '/deals/:id/vote',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: voteRateLimit } },
    async (req, reply) => {
      const { id: dealId } = paramsSchema.parse(req.params);
      const { value } = dealVoteSchema.parse(req.body);
      const prisma = getPrisma();
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal || deal.status === 'deleted') {
        throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
      }
      if (deal.userId === req.user!.id) {
        throw new AppError({ status: 403, code: ERROR_CODES.CANNOT_VOTE_OWN_DEAL, title: 'Cannot vote on your own deal' });
      }
      await prisma.$transaction(async (tx) => {
        await tx.dealVote.upsert({
          where: { userId_dealId: { userId: req.user!.id, dealId } },
          create: { userId: req.user!.id, dealId, value },
          update: { value },
        });
        await recomputeDealScore(tx, dealId);
      });
      return reply.status(204).send();
    },
  );

  app.delete(
    '/deals/:id/vote',
    { onRequest: [app.requireAuth], config: { rateLimit: voteRateLimit } },
    async (req, reply) => {
      const { id: dealId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      await prisma.$transaction(async (tx) => {
        await tx.dealVote.deleteMany({ where: { userId: req.user!.id, dealId } });
        await recomputeDealScore(tx, dealId);
      });
      return reply.status(204).send();
    },
  );
}
