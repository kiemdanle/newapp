import type { FastifyInstance } from 'fastify';
import { meUsageResponseSchema, ITEM_LIMIT } from '@expyrico/shared';
import { getPrisma } from '../../db.js';

export async function usageRoute(app: FastifyInstance) {
  app.get('/usage', { onRequest: app.requireAuth }, async (req, reply) => {
    const userId = req.user!.id;
    const itemCount = await getPrisma().record.count({
      where: { userId, status: 'active' },
    });
    return reply.send(
      meUsageResponseSchema.parse({
        itemCount,
        itemLimit: ITEM_LIMIT,
        readOnly: itemCount >= ITEM_LIMIT,
      }),
    );
  });
}
