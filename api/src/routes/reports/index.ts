import type { FastifyInstance } from 'fastify';
import { createReportRoute } from './create.js';

export async function reportsRoutes(app: FastifyInstance) {
  await app.register(createReportRoute);
}
