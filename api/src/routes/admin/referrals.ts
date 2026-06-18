import type { FastifyInstance } from 'fastify';
import { adminReferralOverviewSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';

const ABUSE_MIN_SAME_IP = 3;
const ABUSE_MIN_REFERRALS = 5;

export async function adminReferralsOverviewRoute(app: FastifyInstance) {
  app.get('/referrals/overview', async () => {
    const prisma = getPrisma();
    const [totalReferrals, totalActivated] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: 'activated' } }),
    ]);

    const topReferrers = await prisma.user.findMany({
      where: { referralsMade: { some: {} } },
      select: {
        id: true,
        firstName: true,
        email: true,
        referralCode: true,
        referralsMade: { select: { id: true, status: true, signupIp: true } },
      },
      orderBy: { referralsMade: { _count: 'desc' } },
      take: 50,
    });

    const rows = topReferrers.map((u) => {
      const referredCount = u.referralsMade.length;
      const activatedCount = u.referralsMade.filter((r) => r.status === 'activated').length;
      const ipCounts = new Map<string, number>();
      for (const r of u.referralsMade) {
        if (r.signupIp) ipCounts.set(r.signupIp, (ipCounts.get(r.signupIp) ?? 0) + 1);
      }
      const maxSameIp = ipCounts.size === 0 ? 0 : Math.max(...ipCounts.values());
      const abuseFlag =
        maxSameIp >= ABUSE_MIN_SAME_IP ||
        (referredCount >= ABUSE_MIN_REFERRALS && activatedCount === 0);
      return {
        referrerUserId: u.id,
        firstName: u.firstName,
        email: u.email,
        referralCode: u.referralCode ?? null,
        referredCount,
        activatedCount,
        abuseFlag,
      };
    });

    return adminReferralOverviewSchema.parse({ totalReferrals, totalActivated, topReferrers: rows });
  });
}
