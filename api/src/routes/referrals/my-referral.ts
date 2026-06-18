import type { FastifyInstance } from 'fastify';
import { referralSummarySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { ensureReferralCode, shareUrlForCode } from '../../services/referrals/repository.js';

export async function myReferralRoute(app: FastifyInstance) {
  app.get('/me/referral', { onRequest: [app.requireAuth] }, async (req) => {
    const userId = req.user!.id;
    const code = await ensureReferralCode(userId);
    const activatedCount = await getPrisma().referral.count({
      where: { referrerUserId: userId, status: 'activated' },
    });
    return referralSummarySchema.parse({
      referralCode: code,
      shareUrl: shareUrlForCode(code),
      activatedCount,
    });
  });
}
