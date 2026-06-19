import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { BarChart } from '@/components/bar-chart';
import { RangeTabs } from '@/components/range-tabs';

export const dynamic = 'force-dynamic';

const RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof RANGES)[number];

export default async function AnalyticsReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range) ? (sp.range as Range) : '30d';
  const data = await serverAdminApi.analytics.reviews(range);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Reviews analytics</h1>
        <RangeTabs basePath="/analytics/reviews" active={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Buy again" value={`${data.buyAgainPct.toFixed(1)}%`} />
        <KpiCard label="Buy again on sale" value={`${data.buyAgainOnSalePct.toFixed(1)}%`} />
        <KpiCard label="Won't buy" value={`${data.wontBuyPct.toFixed(1)}%`} />
        <KpiCard label="Total ratings" value={data.ratingCount.toLocaleString()} />
      </div>

      <KpiCard
        label="Auto-flagged rate"
        value={`${(data.autoFlaggedRate * 100).toFixed(1)}%`}
        sub="Share of new reviews flagged by the profanity filter"
      />

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Reviews per day</h2>
        <BarChart data={data.daily.map((d) => ({ label: d.date, value: d.count }))} />
      </div>
    </div>
  );
}
