import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.pushLogs>>['items'][number];

export default async function SystemPushPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { userId: sp.userId, status: sp.status, cursor: sp.cursor };
  const { items, nextCursor } = await serverAdminApi.system.pushLogs(query);

  const columns: Column<Row>[] = [
    { header: 'Template', cell: (r) => r.templateKey },
    { header: 'User', cell: (r) => <span className="font-mono text-xs">{r.userId}</span> },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Error', cell: (r) => r.errorMessage ?? '—' },
    { header: 'Sent', cell: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Push logs</h1>
      <FilterBar action="/system/push">
        <TextFilter name="userId" label="User ID" value={sp.userId} placeholder="uuid" />
        <SelectFilter
          name="status"
          label="Status"
          value={sp.status}
          options={[
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No push logs match these filters." />
      <LoadMore basePath="/system/push" params={query} nextCursor={nextCursor} />
    </div>
  );
}
