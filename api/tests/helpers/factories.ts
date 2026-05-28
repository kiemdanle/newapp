import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../src/db.js';

export async function makeUser(
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
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
  tasteRating?: number;
  valueRating?: number;
  body?: string | null;
  status?: 'visible' | 'hidden' | 'deleted';
  upvoteCount?: number;
  downvoteCount?: number;
  score?: number;
}) {
  const prisma = getPrisma();
  return prisma.review.create({
    data: {
      userId: overrides.userId,
      productId: overrides.productId,
      tasteRating: overrides.tasteRating ?? 5,
      valueRating: overrides.valueRating ?? 5,
      body: overrides.body ?? 'A solid product.',
      status: overrides.status ?? 'visible',
      upvoteCount: overrides.upvoteCount ?? 0,
      downvoteCount: overrides.downvoteCount ?? 0,
      score: overrides.score ?? 0,
    },
  });
}

export async function makeVote(overrides: {
  userId: string;
  reviewId: string;
  value: 1 | -1;
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
