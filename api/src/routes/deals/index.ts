import type { FastifyInstance } from 'fastify';
import { listFeedRoute } from './list-feed.js';
import { createDealRoute } from './create.js';
import { getDealRoute } from './get.js';
import { updateDealRoute } from './update.js';
import { deleteDealRoute } from './delete.js';
import { dealVoteRoutes } from './vote.js';

export async function dealsRoutes(app: FastifyInstance) {
  await app.register(listFeedRoute);
  await app.register(createDealRoute);
  await app.register(getDealRoute);
  await app.register(updateDealRoute);
  await app.register(deleteDealRoute);
  await app.register(dealVoteRoutes);
}
