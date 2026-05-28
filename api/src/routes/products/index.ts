import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';
import { searchRoute } from './search.js';
import { getProductRoute } from './get.js';
import { createProductRoute } from './create.js';
import { patchProductRoute } from './patch.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
  await app.register(searchRoute);
  await app.register(getProductRoute);
  await app.register(createProductRoute);
  await app.register(patchProductRoute);
}
