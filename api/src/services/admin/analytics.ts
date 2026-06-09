import { getPrisma } from '../../db.js';

export async function overview() {
  const prisma = getPrisma();
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [totalUsers, activeUsers7d, activeUsers30d, totalRecords, totalReviews, scans7d] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: since7 } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: since30 } } }),
      prisma.record.count(),
      prisma.review.count(),
      prisma.record.count({ where: { createdAt: { gte: since7 }, productId: { not: null } } }),
    ]);
  return { totalUsers, activeUsers7d, activeUsers30d, totalRecords, totalReviews, scans7d };
}

function daysFromRange(r: '7d' | '30d' | '90d'): number {
  return r === '7d' ? 7 : r === '30d' ? 30 : 90;
}

export async function scansDaily(range: '7d' | '30d' | '90d') {
  const prisma = getPrisma();
  const since = new Date(Date.now() - daysFromRange(range) * 86400_000);
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', r.created_at) as day, COUNT(*)::bigint as count
    FROM records r
    WHERE r.created_at >= ${since} AND r.product_id IS NOT NULL
    GROUP BY day ORDER BY day ASC
  `;
  const bySource = await prisma.$queryRaw<{ source: string | null; count: bigint }[]>`
    SELECT p.source, COUNT(*)::bigint as count
    FROM records r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE r.created_at >= ${since}
    GROUP BY p.source
  `;
  const sourceCounts = { off: 0, upcitemdb: 0, manual: 0 };
  for (const row of bySource) {
    if (row.source === 'off') sourceCounts.off = Number(row.count);
    else if (row.source === 'upcitemdb') sourceCounts.upcitemdb = Number(row.count);
    else sourceCounts.manual += Number(row.count);
  }
  return {
    range,
    daily: rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    bySource: sourceCounts,
  };
}

export async function reviewsDaily(range: '7d' | '30d' | '90d') {
  const prisma = getPrisma();
  const since = new Date(Date.now() - daysFromRange(range) * 86400_000);
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', created_at) as day, COUNT(*)::bigint as count
    FROM reviews
    WHERE created_at >= ${since}
    GROUP BY day ORDER BY day ASC
  `;
  const [allInWindow, autoFlagged, byRating] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    prisma.review.count({ where: { createdAt: { gte: since }, status: 'hidden' } }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
  for (const row of byRating) tally[row.rating] = row._count._all;
  const ratingCount = tally.buy_again + tally.buy_again_on_sale + tally.wont_buy;
  const pct = (n: number) => (ratingCount === 0 ? 0 : Math.round((n / ratingCount) * 100));
  return {
    range,
    daily: rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    autoFlaggedRate: allInWindow === 0 ? 0 : autoFlagged / allInWindow,
    buyAgainPct: pct(tally.buy_again),
    buyAgainOnSalePct: pct(tally.buy_again_on_sale),
    wontBuyPct: pct(tally.wont_buy),
    ratingCount,
  };
}

export async function geography() {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<{ country: string | null; count: bigint }[]>`
    SELECT country, COUNT(*)::bigint as count
    FROM users
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
    LIMIT 20
  `;
  return { top: rows.map((r) => ({ country: r.country!, users: Number(r.count) })) };
}
