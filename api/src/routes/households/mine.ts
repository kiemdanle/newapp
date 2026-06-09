import type { FastifyInstance } from 'fastify';
import { householdListResponseSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { toApiHousehold } from '../../services/households/repository.js';

export async function mineHouseholdsRoute(app: FastifyInstance) {
  app.get('/households/mine', { onRequest: [app.requireAuth] }, async (req) => {
    const userId = req.user!.id;
    const prisma = getPrisma();
    const memberships = await prisma.householdMember.findMany({
      where: { userId },
      include: { household: { include: { _count: { select: { members: true } } } } },
    });
    const items = memberships.map((m) =>
      toApiHousehold(m.household, { memberCount: m.household._count.members, myRole: m.role }),
    );
    return householdListResponseSchema.parse({ items });
  });
}
