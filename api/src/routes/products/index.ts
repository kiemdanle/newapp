import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';
import { searchRoute } from './search.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
  await app.register(searchRoute);
}
