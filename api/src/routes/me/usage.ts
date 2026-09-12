import type { FastifyInstance } from 'fastify';
import { meUsageResponseSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getUserPantryLimit } from '../../services/records/pantry-limits.js';

export async function usageRoute(app: FastifyInstance) {
  app.get('/usage', { onRequest: app.requireAuth }, async (req, reply) => {
    const userId = req.user!.id;
    const prisma = getPrisma();
    const [itemCount, { limit: itemLimit }] = await Promise.all([
      prisma.record.count({
        where: { userId, status: 'active' },
      }),
      getUserPantryLimit(userId),
    ]);
    return reply.send(
      meUsageResponseSchema.parse({
        itemCount,
        itemLimit,
        readOnly: itemCount >= itemLimit,
      }),
    );
  });
}
