import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, dealPatchSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function updateDealRoute(app: FastifyInstance) {
  app.patch('/deals/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = dealPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.status === 'deleted') {
      throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    }
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your deal' });
    }
    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.storeName !== undefined ? { storeName: input.storeName } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate ? new Date(input.expiryDate) : null } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });
    return toApiDeal(updated, { myVote: null });
  });
}
