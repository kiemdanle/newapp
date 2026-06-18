import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner } from '../../services/households/permissions.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function dissolveHouseholdRoute(app: FastifyInstance) {
  app.delete('/households/:id', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const household = await prisma.household.findUnique({ where: { id } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    await assertOwner(id, req.user!.id);
    // FK onDelete:SetNull reverts all household records to creator-private automatically.
    await prisma.household.delete({ where: { id } });
    return reply.status(204).send();
  });
}
