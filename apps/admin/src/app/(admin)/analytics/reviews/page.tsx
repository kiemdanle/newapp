import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { BarChart } from '@/components/bar-chart';
import { RangeTabs } from '@/components/range-tabs';
import { ThumbsUp, Tag, ThumbsDown, Star, AlertCircle, BarChart2 } from 'lucide-react';

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
    <div className="space-y-8">
      {/* Header & Range Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight">
            Review Analytics
          </h1>
          <p className="text-sm text-neutral-mid mt-1">
            Community sentiment metrics, repurchase intent, and moderation filtering stats.
          </p>
        </div>
        <RangeTabs basePath="/analytics/reviews" active={range} />
      </div>

      {/* Sentiment KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Buy Again"
          value={`${data.buyAgainPct.toFixed(1)}%`}
          icon={ThumbsUp}
          sub="Definite repurchase"
        />
        <KpiCard
          label="Buy on Sale"
          value={`${data.buyAgainOnSalePct.toFixed(1)}%`}
          icon={Tag}
          sub="Price-sensitive repurchase"
        />
        <KpiCard
          label="Won't Buy"
          value={`${data.wontBuyPct.toFixed(1)}%`}
          icon={ThumbsDown}
          sub="Negative purchase experience"
        />
        <KpiCard
          label="Total Ratings"
          value={data.ratingCount.toLocaleString()}
          icon={Star}
          sub={`Ratings in ${range}`}
        />
      </div>

      {/* Auto-flagged filter card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
          <AlertCircle size={20} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-mid">
            Profanity Auto-Flagged Rate
          </div>
          <div className="mt-1 text-2xl font-bold text-neutral-dark font-display">
            {(data.autoFlaggedRate * 100).toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-neutral-mid">
            Share of submitted reviews automatically held for moderation by the profanity sensitivity engine.
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-neutral-dark font-display">
            Reviews Velocity Per Day
          </h2>
        </div>
        <div className="pt-2">
          <BarChart data={data.daily.map((d) => ({ label: d.date, value: d.count }))} height={240} />
        </div>
      </div>
    </div>
  );
}
