import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { toProblem } from '../errors.js';

export const adminOnlyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (req, reply) => {
    try {
      await app.requireAdmin(req, reply);
    } catch (err) {
      // Reply directly rather than rethrowing: encapsulated sub-apps (e.g. bull-board)
      // install their own error handler that would otherwise render this as a 500.
      const problem = toProblem(err);
      return reply.status(problem.status).type('application/problem+json').send(problem);
    }
  });
});
