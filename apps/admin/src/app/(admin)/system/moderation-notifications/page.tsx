import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.moderationNotifications.list>>['items'][number];

export default async function ModerationNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { status: sp.status, cursor: sp.cursor };
  const [{ items, nextCursor }, health] = await Promise.all([
    serverAdminApi.system.moderationNotifications.list(query),
    serverAdminApi.system.moderationNotifications.health(),
  ]);
  const columns: Column<Row>[] = [
    { header: 'Created', cell: (row) => new Date(row.createdAt).toLocaleString() },
    { header: 'Window', cell: (row) => `${new Date(row.windowStart).toLocaleTimeString()} – ${new Date(row.windowEnd).toLocaleTimeString()}` },
    { header: 'New products', cell: (row) => row.newProductCount },
    { header: 'Revisions', cell: (row) => row.revisionCount },
    { header: 'Recipients', cell: (row) => row.recipientCount },
    { header: 'Details', cell: (row) => <Link href={`/system/moderation-notifications/${row.id}`} className="font-semibold text-primary-dark hover:underline">View deliveries</Link> },
    {
      header: 'Deliveries',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(row.deliverySummary)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => <StatusBadge key={status} status={`${status} (${count})`} />)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Moderation notifications</h1>
          <p className="mt-1 text-sm text-neutral-mid">Durable batch and channel outcomes. Content is count-only.</p>
        </div>
        <Link href="/products/pending" className="text-sm font-semibold text-primary-dark hover:underline">Open moderation queue</Link>
      </div>

      <section aria-label="Pipeline health" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthCard label="Last successful tick" value={health.lastSuccessfulTickAt ? new Date(health.lastSuccessfulTickAt).toLocaleString() : 'Never'} />
        <HealthCard label="Oldest unbatched event" value={health.oldestUnbatchedEventAt ? new Date(health.oldestUnbatchedEventAt).toLocaleString() : 'None'} />
        <HealthCard label="Due deliveries" value={`${health.pendingDeliveries} pending`} />
        <HealthCard label="Terminal failures" value={String(health.terminalFailures)} />
      </section>

      <FilterBar action="/system/moderation-notifications">
        <SelectFilter
          name="status"
          label="Delivery status"
          value={sp.status}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'processing', label: 'Processing' },
            { value: 'sent', label: 'Sent' },
            { value: 'skipped', label: 'Skipped' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No moderation notification batches match these filters." />
      <LoadMore basePath="/system/moderation-notifications" params={query} nextCursor={nextCursor} />
    </div>
  );
}

function HealthCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-mid">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-dark">{value}</p>
    </div>
  );
}
