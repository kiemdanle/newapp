import type { Giveaway, GiveawayClaim, Product, User, Prisma } from '@prisma/client';
import type { Giveaway as ApiGiveaway, Claim as ApiClaim } from '@pantry/shared';

type GiveawayWithRelations = Giveaway & {
  giver?: Pick<User, 'id' | 'firstName' | 'avatarUrl' | 'giverRatingAvg' | 'transactionCount'> | null;
  product?: Pick<Product, 'id' | 'name'> | null;
  claims?: GiveawayClaim[];
  _count?: { claims: number };
};

type ClaimWithClaimer = GiveawayClaim & {
  claimer?: Pick<User, 'id' | 'firstName' | 'avatarUrl' | 'recipientRatingAvg' | 'transactionCount'> | null;
};

function getSelectedRecipientId(claims?: GiveawayClaim[]): string | null {
  if (!claims) return null;
  return claims.find((c) => c.status === 'selected')?.claimerUserId ?? null;
}

export function toApiGiveaway(
  g: GiveawayWithRelations,
  opts: { myClaim?: GiveawayClaim | null } = {},
): ApiGiveaway {
  const selectedRecipientId = getSelectedRecipientId(g.claims);
  const out: ApiGiveaway = {
    id: g.id,
    giverUserId: g.giverUserId,
    productId: g.productId,
    recordId: g.recordId,
    title: g.title,
    description: g.description,
    photoUrl: g.photoUrl,
    locationText: g.locationText,
    country: g.country,
    status: g.status,
    selectedRecipientId,
    claimExpiresAt: g.claimExpiresAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    handedOffAt: g.handedOffAt?.toISOString() ?? null,
    confirmedAt: g.confirmedAt?.toISOString() ?? null,
    completedAt: g.completedAt?.toISOString() ?? null,
    claimCount: g._count?.claims,
    myClaim: opts.myClaim
      ? { id: opts.myClaim.id, status: opts.myClaim.status, pickupNote: opts.myClaim.pickupNote }
      : null,
  };
  if (g.giver) {
    out.giver = {
      id: g.giver.id,
      firstName: g.giver.firstName,
      avatarUrl: g.giver.avatarUrl,
      giverRatingAvg: g.giver.giverRatingAvg !== null ? Number(g.giver.giverRatingAvg) : null,
      transactionCount: g.giver.transactionCount,
    };
  }
  return out;
}

export function toApiClaim(
  c: ClaimWithClaimer,
  opts: { revealNote: boolean } = { revealNote: false },
): ApiClaim {
  const out: ApiClaim = {
    id: c.id,
    giveawayId: c.giveawayId,
    claimerUserId: c.claimerUserId,
    pickupNote: opts.revealNote ? c.pickupNote : null,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  };
  if (c.claimer) {
    out.claimer = {
      id: c.claimer.id,
      firstName: c.claimer.firstName,
      avatarUrl: c.claimer.avatarUrl,
      recipientRatingAvg: c.claimer.recipientRatingAvg !== null ? Number(c.claimer.recipientRatingAvg) : null,
      transactionCount: c.claimer.transactionCount,
    };
  }
  return out;
}
