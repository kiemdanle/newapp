import type { FastifyInstance } from 'fastify';
import { profileRoute } from './profile.js';

export async function meRoutes(app: FastifyInstance) {
  await app.register(profileRoute);
}
