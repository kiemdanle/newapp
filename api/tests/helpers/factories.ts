import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../src/db.js';

export async function makeUser(
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
    country: string | null;
  }> = {},
) {
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `u-${randomUUID()}@test.local`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      emailVerifiedAt: overrides.emailVerified ? new Date() : null,
      role: overrides.role ?? 'user',
      ...(overrides.country !== undefined ? { country: overrides.country } : {}),
    },
  });
}

export async function makeProduct(
  overrides: Partial<{
    barcode: string;
    qrPayload: string;
    name: string;
    brand: string;
    source: 'off' | 'upcitemdb' | 'user';
    sourceId: string;
    defaultShelfLifeDays: number;
    createdByUserId: string;
  }> = {},
) {
  const prisma = getPrisma();
  return prisma.product.create({
    data: {
      barcode: overrides.barcode ?? `bc-${randomUUID()}`,
      qrPayload: overrides.qrPayload ?? null,
      name: overrides.name ?? 'Test Product',
      brand: overrides.brand ?? 'TestBrand',
      source: overrides.source ?? 'user',
      sourceId: overrides.sourceId ?? null,
      defaultShelfLifeDays: overrides.defaultShelfLifeDays ?? null,
      createdByUserId: overrides.createdByUserId ?? null,
    },
  });
}

export async function makeRecord(
  userId: string,
  overrides: Partial<{
    productId: string | null;
    customName: string;
    expiryDate: Date;
    quantity: number;
    unit: string;
    status: 'active' | 'consumed' | 'discarded' | 'expired';
    clientId: string;
    notifyAt: string[];
  }> = {},
) {
  const prisma = getPrisma();
  return prisma.record.create({
    data: {
      userId,
      productId: overrides.productId ?? null,
      customName: overrides.customName ?? 'Manual item',
      expiryDate: overrides.expiryDate ?? new Date(Date.now() + 7 * 24 * 3600 * 1000),
      quantity: overrides.quantity ?? 1,
      unit: overrides.unit ?? 'pcs',
      status: overrides.status ?? 'active',
      clientId: overrides.clientId ?? randomUUID(),
      notifyAt: overrides.notifyAt ?? [],
    },
  });
}

export async function makeReview(overrides: {
  userId: string;
  productId: string;
  rating?: 'buy_again' | 'buy_again_on_sale' | 'wont_buy';
  body?: string | null;
  status?: 'visible' | 'hidden' | 'deleted';
  helpfulCount?: number;
  notHelpfulCount?: number;
  score?: number;
}) {
  const prisma = getPrisma();
  return prisma.review.create({
    data: {
      userId: overrides.userId,
      productId: overrides.productId,
      rating: overrides.rating ?? 'buy_again',
      body: overrides.body !== undefined ? overrides.body : 'A solid product.',
      status: overrides.status ?? 'visible',
      helpfulCount: overrides.helpfulCount ?? 0,
      notHelpfulCount: overrides.notHelpfulCount ?? 0,
      score: overrides.score ?? 0,
    },
  });
}

export async function makeVote(overrides: {
  userId: string;
  reviewId: string;
  value: 'helpful' | 'not_helpful';
}) {
  const prisma = getPrisma();
  return prisma.reviewVote.create({
    data: {
      userId: overrides.userId,
      reviewId: overrides.reviewId,
      value: overrides.value,
    },
  });
}

export async function makeDeal(overrides: {
  userId: string;
  productId: string;
  price?: number;
  currency?: string;
  storeName?: string;
  photoUrl?: string | null;
  expiryDate?: Date | null;
  note?: string | null;
  country?: string | null;
  status?: 'visible' | 'hidden' | 'deleted';
  upvoteCount?: number;
  downvoteCount?: number;
  score?: number;
}) {
  const prisma = getPrisma();
  return prisma.deal.create({
    data: {
      userId: overrides.userId,
      productId: overrides.productId,
      price: overrides.price ?? 4.99,
      currency: overrides.currency ?? 'USD',
      storeName: overrides.storeName ?? 'Corner Mart',
      photoUrl: overrides.photoUrl ?? null,
      expiryDate: overrides.expiryDate ?? null,
      note: overrides.note ?? null,
      country: overrides.country !== undefined ? overrides.country : null,
      status: overrides.status ?? 'visible',
      upvoteCount: overrides.upvoteCount ?? 0,
      downvoteCount: overrides.downvoteCount ?? 0,
      score: overrides.score ?? 0,
    },
  });
}

export async function makeDealVote(overrides: {
  userId: string;
  dealId: string;
  value: 1 | -1;
}) {
  const prisma = getPrisma();
  return prisma.dealVote.create({
    data: { userId: overrides.userId, dealId: overrides.dealId, value: overrides.value },
  });
}

export async function makeGiveaway(overrides: {
  giverUserId: string;
  productId?: string;
  recordId?: string;
  title?: string;
  description?: string;
  locationText?: string;
  country?: string | null;
  status?: 'open' | 'claimed' | 'handed_off' | 'completed' | 'cancelled';
}) {
  const prisma = getPrisma();
  return prisma.giveaway.create({
    data: {
      giverUserId: overrides.giverUserId,
      productId: overrides.productId ?? null,
      recordId: overrides.recordId ?? null,
      title: overrides.title ?? 'Free pasta, best before next week',
      description: overrides.description ?? null,
      locationText: overrides.locationText ?? 'Near Central Station',
      country: overrides.country !== undefined ? overrides.country : null,
      status: overrides.status ?? 'open',
    },
  });
}

export async function makeClaim(overrides: {
  giveawayId: string;
  claimerUserId: string;
  pickupNote?: string;
  status?: 'requested' | 'selected' | 'rejected';
}) {
  const prisma = getPrisma();
  return prisma.giveawayClaim.create({
    data: {
      giveawayId: overrides.giveawayId,
      claimerUserId: overrides.claimerUserId,
      pickupNote: overrides.pickupNote ?? 'Can pick up after 6pm.',
      status: overrides.status ?? 'requested',
    },
  });
}

export async function makeTransactionRating(overrides: {
  giveawayId: string;
  raterUserId: string;
  rateeUserId: string;
  raterRole: 'giver' | 'recipient';
  stars?: number;
  comment?: string;
}) {
  const prisma = getPrisma();
  return prisma.transactionRating.create({
    data: {
      giveawayId: overrides.giveawayId,
      raterUserId: overrides.raterUserId,
      rateeUserId: overrides.rateeUserId,
      raterRole: overrides.raterRole,
      stars: overrides.stars ?? 5,
      comment: overrides.comment ?? null,
    },
  });
}

export async function makeReferral(overrides: {
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  status?: 'pending' | 'activated';
}) {
  const prisma = getPrisma();
  return prisma.referral.create({
    data: {
      referrerUserId: overrides.referrerUserId,
      referredUserId: overrides.referredUserId,
      referralCode: overrides.referralCode,
      status: overrides.status ?? 'pending',
    },
  });
}

export async function makeUserWithCode(code: string): Promise<{ id: string; referralCode: string }> {
  const u = await makeUser({ emailVerified: true });
  const prisma = getPrisma();
  await prisma.user.update({ where: { id: u.id }, data: { referralCode: code } });
  return { id: u.id, referralCode: code };
}

export async function makeHousehold(ownerUserId: string, overrides: Partial<{ name: string }> = {}) {
  const prisma = getPrisma();
  const household = await prisma.household.create({
    data: { name: overrides.name ?? 'Test Household', ownerUserId },
  });
  await prisma.householdMember.create({
    data: { householdId: household.id, userId: ownerUserId, role: 'owner' },
  });
  return household;
}

export async function makeMembership(householdId: string, userId: string, overrides: Partial<{ role: 'owner' | 'member' }> = {}) {
  const prisma = getPrisma();
  return prisma.householdMember.create({
    data: { householdId, userId, role: overrides.role ?? 'member' },
  });
}
