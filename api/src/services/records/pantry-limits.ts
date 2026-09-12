import type { Prisma, PrismaClient } from '@prisma/client';
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPantryLimits } from '../admin/settings.js';

export interface UserPantryLimitResult {
  limit: number;
  source: 'default_setting' | 'subscription_tier';
}

/**
 * Resolves the pantry item limit for a given user.
 * Currently backed by platform-wide admin settings with forward-compatible
 * architecture for subscription tiers.
 *
 * Future Tier Integration Hook:
 * When Stripe / Polar subscription billing launches:
 * 1. Look up user active tier (e.g. user.tier or subscription.tier: 'free' | 'pro' | 'supporter').
 * 2. If user.tier && settings.tierLimits?.[user.tier]:
 *    return { limit: settings.tierLimits[user.tier], source: 'subscription_tier' };
 * 3. Default fallback: settings.defaultUserPantryLimit.
 */
export async function getUserPantryLimit(
  _userId: string,
  _tx?: Prisma.TransactionClient | PrismaClient,
): Promise<UserPantryLimitResult> {
  const settings = await getPantryLimits();
  return {
    limit: settings.defaultUserPantryLimit,
    source: 'default_setting',
  };
}

/**
 * Acquires a PostgreSQL transaction-level advisory lock on the user's ID
 * via hashtext(userId)::bigint. Serializes concurrent modifications affecting
 * this user's active pantry item quota within the transaction.
 */
export async function lockUserPantryQuota(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`;
}

/**
 * Asserts that the specified owner has capacity to add `countToAdd` active pantry items.
 * Must be invoked within an interactive transaction under `lockUserPantryQuota`.
 */
export async function assertCanAddPantryItems(
  userId: string,
  countToAdd = 1,
  tx: Prisma.TransactionClient,
): Promise<{ activeCount: number; limit: number }> {
  const { limit } = await getUserPantryLimit(userId, tx);
  const activeCount = await tx.record.count({
    where: { userId, status: 'active' },
  });

  if (activeCount + countToAdd > limit) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.ITEM_LIMIT_REACHED,
      title: `Pantry item limit of ${limit} reached. Upgrade or delete items to add more.`,
    });
  }

  return { activeCount, limit };
}
