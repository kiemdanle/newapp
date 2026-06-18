import type { Deal, Product, User, Prisma, PrismaClient } from '@prisma/client';
import type { Deal as ApiDeal } from '@expyrico/shared';
import { wilsonLowerBound } from '../reviews/wilson.js';

type Db = PrismaClient | Prisma.TransactionClient;

export async function recomputeDealScore(db: Db, dealId: string): Promise<void> {
  const agg = await db.dealVote.groupBy({
    by: ['value'],
    where: { dealId },
    _count: { _all: true },
  });
  let up = 0;
  let down = 0;
  for (const row of agg) {
    if (row.value === 1) up = row._count._all;
    else if (row.value === -1) down = row._count._all;
  }
  await db.deal.update({
    where: { id: dealId },
    data: { upvoteCount: up, downvoteCount: down, score: wilsonLowerBound(up, down) },
  });
}

type DealWithRelations = Deal & {
  product?: Pick<Product, 'id' | 'name' | 'brand' | 'imageUrl'> | null;
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiDeal(
  d: DealWithRelations,
  opts: { myVote?: -1 | 1 | null } = {},
): ApiDeal {
  const out: ApiDeal = {
    id: d.id,
    userId: d.userId,
    productId: d.productId,
    price: Number(d.price),
    currency: d.currency,
    storeName: d.storeName,
    photoUrl: d.photoUrl,
    expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
    note: d.note,
    country: d.country,
    upvoteCount: d.upvoteCount,
    downvoteCount: d.downvoteCount,
    score: Number(d.score),
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    myVote: opts.myVote ?? null,
  };
  if (d.product) {
    out.product = {
      id: d.product.id,
      name: d.product.name,
      brand: d.product.brand,
      imageUrl: d.product.imageUrl,
    };
  }
  if (d.user) {
    out.author = { id: d.user.id, firstName: d.user.firstName, avatarUrl: d.user.avatarUrl };
  }
  return out;
}
