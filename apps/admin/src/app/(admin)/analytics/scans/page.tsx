import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { BarChart } from '@/components/bar-chart';
import { RangeTabs } from '@/components/range-tabs';

export const dynamic = 'force-dynamic';

const RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof RANGES)[number];

export default async function AnalyticsScansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range) ? (sp.range as Range) : '30d';
  const data = await serverAdminApi.analytics.scans(range);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Scans</h1>
        <RangeTabs basePath="/analytics/scans" active={range} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Open Food Facts" value={data.bySource.off.toLocaleString()} />
        <KpiCard label="UPCitemdb" value={data.bySource.upcitemdb.toLocaleString()} />
        <KpiCard label="Manual" value={data.bySource.manual.toLocaleString()} />
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Daily scans</h2>
        <BarChart data={data.daily.map((d) => ({ label: d.date, value: d.count }))} />
      </div>
    </div>
  );
}
