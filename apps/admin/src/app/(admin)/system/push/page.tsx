import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';
import { Smartphone, Send } from 'lucide-react';

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
    {
      header: 'Template / Message',
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-neutral-dark rounded-md bg-neutral-light px-2 py-0.5 border border-neutral-200">
          {r.templateKey}
        </span>
      ),
    },
    {
      header: 'Recipient User',
      cell: (r) => (
        <span className="font-mono text-xs text-neutral-mid truncate max-w-[140px] block">
          {r.userId}
        </span>
      ),
    },
    { header: 'Delivery Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Error Log',
      cell: (r) => (
        <span className="text-xs text-neutral-mid truncate max-w-sm block">
          {r.errorMessage ?? '—'}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Smartphone size={14} />
          <span>FCM & APNs Activity</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Push Notification Logs
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Audit delivery attempts, token invalidations, and push notification errors.
        </p>
      </div>

      <FilterBar action="/system/push">
        <TextFilter name="userId" label="Recipient User ID" value={sp.userId} placeholder="Filter by user UUID…" />
        <SelectFilter
          name="status"
          label="Delivery Status"
          value={sp.status}
          options={[
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No push notification logs match these filters." />
      <LoadMore basePath="/system/push" params={query} nextCursor={nextCursor} />
    </div>
  );
}
