import type { FastifyInstance } from 'fastify';
import { listGiveawaysRoute } from './list-feed.js';
import { createGiveawayRoute } from './create.js';
import { getGiveawayRoute } from './get.js';
import { updateGiveawayRoute } from './update.js';
import { cancelGiveawayRoute } from './cancel.js';
import { claimsRoute } from './claims.js';
import { selectClaimRoute } from './select.js';
import { handOffRoute } from './hand-off.js';
import { confirmReceivedRoute } from './confirm-received.js';
import { ratingsRoute } from './ratings.js';

export async function giveawaysRoutes(app: FastifyInstance) {
  await app.register(listGiveawaysRoute);
  await app.register(createGiveawayRoute);
  await app.register(getGiveawayRoute);
  await app.register(updateGiveawayRoute);
  await app.register(cancelGiveawayRoute);
  await app.register(claimsRoute);
  await app.register(selectClaimRoute);
  await app.register(handOffRoute);
  await app.register(confirmReceivedRoute);
  await app.register(ratingsRoute);
}
