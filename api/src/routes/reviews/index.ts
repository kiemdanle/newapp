import type { FastifyInstance } from 'fastify';
import { listForProductRoute } from './list-for-product.js';

export async function reviewsRoutes(app: FastifyInstance) {
  await app.register(listForProductRoute);
}
