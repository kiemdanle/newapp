import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { householdPatchSchema, householdSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner } from '../../services/households/permissions.js';
import { toApiHousehold } from '../../services/households/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function patchHouseholdRoute(app: FastifyInstance) {
  app.patch('/households/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = householdPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const household = await prisma.household.findUnique({ where: { id } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    await assertOwner(id, req.user!.id);
    const updated = await prisma.household.update({ where: { id }, data: { name: input.name } });
    const count = await prisma.householdMember.count({ where: { householdId: id } });
    return householdSchema.parse(toApiHousehold(updated, { memberCount: count, myRole: 'owner' }));
  });
}
