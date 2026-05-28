import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
}
