import type { FastifyInstance } from 'fastify';
import { listForProductRoute } from './list-for-product.js';
import { createReviewRoute } from './create.js';
import { reviewHelpfulRoutes } from './helpful.js';
import { updateReviewRoute } from './update.js';
import { myReviewsRoute } from './my-reviews.js';

export async function reviewsRoutes(app: FastifyInstance) {
  await app.register(listForProductRoute);
  await app.register(createReviewRoute);
  await app.register(reviewHelpfulRoutes);
  await app.register(updateReviewRoute);
  await app.register(myReviewsRoute);
}
