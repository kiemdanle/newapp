import type { FastifyInstance } from 'fastify';
import { feedbackAttachmentRoutes } from './attachments.js';
import { createFeedbackRoute } from './create.js';
import { listFeedbackRoute } from './list.js';
import { getFeedbackRoute } from './get.js';
import { feedbackMessagesRoute } from './messages.js';

export async function feedbackRoutes(app: FastifyInstance) {
  await app.register(feedbackAttachmentRoutes);
  await app.register(createFeedbackRoute);
  await app.register(listFeedbackRoute);
  await app.register(getFeedbackRoute);
  await app.register(feedbackMessagesRoute);
}
