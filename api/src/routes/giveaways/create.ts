import type { FastifyInstance } from 'fastify';
import { giveawayCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

export async function createGiveawayRoute(app: FastifyInstance) {
  app.post(
    '/giveaways',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = giveawayCreateSchema.parse(req.body);
      const prisma = getPrisma();
      const userId = req.user!.id;

      if (input.recordId) {
        const record = await prisma.record.findUnique({ where: { id: input.recordId } });
        if (!record) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
        if (record.userId !== userId) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your record' });
      }
      if (input.productId) {
        const product = await prisma.product.findUnique({ where: { id: input.productId } });
        if (!product) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
      }

      const giver = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      const country = giver?.country ?? null;

      const created = await prisma.giveaway.create({
        data: {
          giverUserId: userId,
          title: input.title,
          description: input.description ?? null,
          locationText: input.locationText,
          photoUrl: input.photoUrl ?? null,
          productId: input.productId ?? null,
          recordId: input.recordId ?? null,
          country,
        },
        include: {
          giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
          claims: true,
          _count: { select: { claims: true } },
        },
      });
      return reply.status(201).send(toApiGiveaway(created, { myClaim: null }));
    },
  );
}
