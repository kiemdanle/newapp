import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.reports.list>>['items'][number];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = {
    status: sp.status ?? 'open',
    targetType: sp.targetType,
    cursor: sp.cursor,
  };
  const { items, nextCursor } = await serverAdminApi.reports.list(query);

  const columns: Column<Row>[] = [
    {
      header: 'Target',
      cell: (r) => (
        <Link href={`/reports/${r.id}`} className="font-medium hover:underline">
          {r.targetType}
        </Link>
      ),
    },
    { header: 'Reason', cell: (r) => r.reason },
    {
      header: 'Detail',
      cell: (r) => <span className="text-muted-foreground">{r.body ?? '—'}</span>,
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Reported', cell: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>
      <FilterBar action="/reports">
        <SelectFilter
          name="status"
          label="Status"
          value={query.status}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'dismissed', label: 'Dismissed' },
          ]}
        />
        <SelectFilter
          name="targetType"
          label="Target type"
          value={sp.targetType}
          options={[
            { value: 'review', label: 'Review' },
            { value: 'user', label: 'User' },
            { value: 'product', label: 'Product' },
          ]}
        />
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No reports match these filters." />
      <LoadMore basePath="/reports" params={query} nextCursor={nextCursor} />
    </div>
  );
}
