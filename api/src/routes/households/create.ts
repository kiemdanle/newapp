import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { householdCreateSchema, householdSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiHousehold } from '../../services/households/repository.js';

export async function createHouseholdRoute(app: FastifyInstance) {
  app.post(
    '/households',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = householdCreateSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();
      const household = await prisma.$transaction(async (tx) => {
        const h = await tx.household.create({ data: { name: input.name, ownerUserId: userId } });
        await tx.householdMember.create({ data: { householdId: h.id, userId, role: 'owner' } });
        return h;
      });
      return reply.status(201).send(householdSchema.parse(toApiHousehold(household, { memberCount: 1, myRole: 'owner' })));
    },
  );
}
