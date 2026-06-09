import type { FastifyInstance } from 'fastify';
import { myReferralRoute } from './my-referral.js';

export async function referralRoutes(app: FastifyInstance) {
  await app.register(myReferralRoute);
}
