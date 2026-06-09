import { getPrisma } from '../../db.js';

const ACTIVATION_THRESHOLD = 5;

/**
 * Idempotent activation check. Called after every record persist (direct create
 * AND sync ingest). When the referred user's lifetime record count reaches 5,
 * their pending referral (if any) is marked activated. No rewards in v1.x.
 */
export async function maybeActivateReferral(userId: string): Promise<void> {
  const prisma = getPrisma();
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: userId },
    select: { id: true, status: true },
  });
  if (!referral || referral.status !== 'pending') return;

  const recordCount = await prisma.record.count({ where: { userId } });
  if (recordCount < ACTIVATION_THRESHOLD) return;

  await prisma.referral.updateMany({
    where: { id: referral.id, status: 'pending' },
    data: { status: 'activated', activatedAt: new Date() },
  });
}
