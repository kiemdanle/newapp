import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function deleteDealRoute(app: FastifyInstance) {
  app.delete('/deals/:id', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your deal' });
    }
    await prisma.deal.update({ where: { id }, data: { status: 'deleted' } });
    return reply.status(204).send();
  });
}
