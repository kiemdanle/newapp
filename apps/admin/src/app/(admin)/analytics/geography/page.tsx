import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { Globe } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.analytics.geography>>['top'][number];

export default async function AnalyticsGeographyPage() {
  const geo = await serverAdminApi.analytics.geography();
  const max = Math.max(1, ...geo.top.map((r) => r.users));

  const columns: Column<Row>[] = [
    {
      header: 'Country',
      cell: (r) => (
        <span className="font-semibold text-neutral-dark font-mono text-sm">
          {r.country || 'Unknown'}
        </span>
      ),
    },
    {
      header: 'Users',
      cell: (r) => (
        <span className="font-medium text-neutral-dark">
          {r.users.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'User Distribution',
      cell: (r) => {
        const pct = Math.round((r.users / max) * 100);
        return (
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-48 rounded-full bg-neutral-light overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-neutral-mid font-mono">{pct}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Globe size={14} />
          <span>Demographics</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Geographic Distribution
        </h1>
        <p className="text-sm text-neutral-mid mt-1">
          Top geographic distribution of registered platform users based on country indicators.
        </p>
      </div>

      <DataTable data={geo.top} columns={columns} empty="No geographic data registered yet." />
    </div>
  );
}
