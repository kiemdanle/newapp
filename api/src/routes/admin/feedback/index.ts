import type { FastifyInstance } from 'fastify';
import { adminFeedbackListRoute } from './list.js';
import { adminFeedbackCountsRoute } from './counts.js';
import { adminFeedbackGetRoute } from './get.js';
import { adminFeedbackReplyRoute } from './reply.js';
import { adminFeedbackStatusRoute } from './status.js';

export async function adminFeedbackRoutes(app: FastifyInstance) {
  await app.register(adminFeedbackListRoute);
  await app.register(adminFeedbackCountsRoute);
  await app.register(adminFeedbackGetRoute);
  await app.register(adminFeedbackReplyRoute);
  await app.register(adminFeedbackStatusRoute);
}
