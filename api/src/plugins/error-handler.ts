import type { FastifyInstance, FastifyError } from 'fastify';
import { toProblem } from '../errors.js';

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const problem = toProblem(err);
    if (problem.status >= 500) {
      req.log.error({ err }, 'unhandled error');
    } else {
      req.log.warn({ err: { code: problem.code, status: problem.status } }, 'request error');
    }
    void reply.status(problem.status).type('application/problem+json').send(problem);
  });
  app.setNotFoundHandler((req, reply) => {
    void reply.status(404).type('application/problem+json').send({
      title: 'Not found',
      status: 404,
      code: 'not_found',
      instance: req.url,
    });
  });
}
