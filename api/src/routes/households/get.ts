import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { householdSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertMember } from '../../services/households/permissions.js';
import { toApiHousehold } from '../../services/households/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function getHouseholdRoute(app: FastifyInstance) {
  app.get('/households/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const userId = req.user!.id;
    const prisma = getPrisma();
    const household = await prisma.household.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    const m = await assertMember(id, userId);
    return householdSchema.parse(toApiHousehold(household, { memberCount: household._count.members, myRole: m.role }));
  });
}
