import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getPrisma } from '../db.js';

export const apiErrorRecorderPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (req, reply) => {
    if (reply.statusCode < 400) return;
    try {
      await getPrisma().apiError.create({
        data: {
          route: req.routeOptions?.url ?? req.url,
          method: req.method,
          status: reply.statusCode,
          code: null,
          message: null,
          requestId: (req.headers['x-request-id'] as string) ?? req.id,
          userId: req.user?.id ?? null,
        },
      });
    } catch (e) {
      req.log.warn({ err: e }, 'api-error-recorder failed');
    }
  });
});
