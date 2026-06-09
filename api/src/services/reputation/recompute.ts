import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function recomputeReputation(tx: Tx, userId: string): Promise<void> {
  const perCounterparty = await tx.transactionRating.groupBy({
    by: ['raterUserId', 'raterRole'],
    where: { rateeUserId: userId },
    _avg: { stars: true },
  });

  const recipientVals: number[] = [];
  const giverVals: number[] = [];
  const counterparties = new Set<string>();
  for (const row of perCounterparty) {
    counterparties.add(row.raterUserId);
    const v = Number(row._avg.stars ?? 0);
    if (row.raterRole === 'giver') recipientVals.push(v);
    else if (row.raterRole === 'recipient') giverVals.push(v);
  }
  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

  await tx.user.update({
    where: { id: userId },
    data: {
      recipientRatingAvg: mean(recipientVals),
      giverRatingAvg: mean(giverVals),
      transactionCount: counterparties.size,
    },
  });
}
