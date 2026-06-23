import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.analytics.geography>>['top'][number];

export default async function AnalyticsGeographyPage() {
  const geo = await serverAdminApi.analytics.geography();
  const max = Math.max(1, ...geo.top.map((r) => r.users));

  const columns: Column<Row>[] = [
    { header: 'Country', cell: (r) => r.country },
    { header: 'Users', cell: (r) => r.users.toLocaleString() },
    {
      header: 'Share',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${(r.users / max) * 100}%` }}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Geography</h1>
      <p className="text-sm text-neutral-mid">Top countries by user count.</p>
      <DataTable data={geo.top} columns={columns} empty="No geographic data yet." />
    </div>
  );
}
