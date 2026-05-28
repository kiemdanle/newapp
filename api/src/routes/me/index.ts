import type { FastifyInstance } from 'fastify';
import { profileRoute } from './profile.js';
import { pushTokenRoutes } from './push-token.js';

export async function meRoutes(app: FastifyInstance) {
  await app.register(profileRoute);
  await app.register(pushTokenRoutes);
}
