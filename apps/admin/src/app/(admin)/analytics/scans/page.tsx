import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { BarChart } from '@/components/bar-chart';
import { RangeTabs } from '@/components/range-tabs';
import { Database, QrCode, Edit3, BarChart2 } from 'lucide-react';

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
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight">
            Barcode Scans
          </h1>
          <p className="text-sm text-neutral-mid mt-1">
            Barcode lookup volume breakdown across external data providers and user manual entries.
          </p>
        </div>
        <RangeTabs basePath="/analytics/scans" active={range} />
      </div>

      {/* Provider KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Open Food Facts"
          value={data.bySource.off.toLocaleString()}
          icon={Database}
          sub="Resolved via OFF database"
        />
        <KpiCard
          label="UPCitemdb"
          value={data.bySource.upcitemdb.toLocaleString()}
          icon={QrCode}
          sub="Resolved via UPCitemdb API"
        />
        <KpiCard
          label="Manual Entry"
          value={data.bySource.manual.toLocaleString()}
          icon={Edit3}
          sub="Created or entered by users"
        />
      </div>

      {/* Chart Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-neutral-dark font-display">
            Daily Scan Activity
          </h2>
        </div>
        <div className="pt-2">
          <BarChart data={data.daily.map((d) => ({ label: d.date, value: d.count }))} height={240} />
        </div>
      </div>
    </div>
  );
}
