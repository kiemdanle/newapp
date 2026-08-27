import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { KpiCard } from '@/components/kpi-card';
import { Bell, ArrowRight, Activity, Clock, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    {
      header: 'Batch Created',
      cell: (row) => (
        <span className="text-xs text-neutral-dark font-mono font-medium">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Aggregation Window',
      cell: (row) => (
        <span className="text-xs text-neutral-mid font-mono">
          {`${new Date(row.windowStart).toLocaleTimeString()} – ${new Date(row.windowEnd).toLocaleTimeString()}`}
        </span>
      ),
    },
    {
      header: 'New Submissions',
      cell: (row) => (
        <span className="text-xs font-semibold text-neutral-dark">
          {row.newProductCount}
        </span>
      ),
    },
    {
      header: 'Revisions',
      cell: (row) => (
        <span className="text-xs font-semibold text-neutral-dark">
          {row.revisionCount}
        </span>
      ),
    },
    {
      header: 'Recipients',
      cell: (row) => (
        <span className="text-xs text-neutral-mid">
          {row.recipientCount} admins
        </span>
      ),
    },
    {
      header: 'Deliveries',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(row.deliverySummary)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-md bg-neutral-light px-2 py-0.5 text-[11px] font-medium text-neutral-dark border border-neutral-200"
              >
                <span className="capitalize">{status}</span>: <span className="font-bold">{count}</span>
              </span>
            ))}
        </div>
      ),
    },
    {
      header: 'Action',
      cell: (row) => (
        <Link
          href={`/system/moderation-notifications/${row.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <span>View batch</span>
          <ArrowRight size={12} />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Bell size={14} />
            <span>Admin Broadcasts</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Moderation Notifications
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Durable batch and channel delivery outcomes for moderator email/push alerts.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-xl shadow-xs gap-1.5 self-start sm:self-auto">
          <Link href="/products/pending">
            <Clock size={16} />
            <span>Open review queue</span>
          </Link>
        </Button>
      </div>

      {/* Pipeline Health */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Last Tick Time"
          value={health.lastSuccessfulTickAt ? new Date(health.lastSuccessfulTickAt).toLocaleTimeString() : 'Never'}
          icon={Activity}
          sub={health.lastSuccessfulTickAt ? new Date(health.lastSuccessfulTickAt).toLocaleDateString() : undefined}
        />
        <KpiCard
          label="Oldest Pending Event"
          value={health.oldestUnbatchedEventAt ? new Date(health.oldestUnbatchedEventAt).toLocaleTimeString() : 'None'}
          icon={Clock}
          sub={health.oldestUnbatchedEventAt ? 'Awaiting batch flush' : 'Queue fully drained'}
        />
        <KpiCard
          label="Due Deliveries"
          value={health.pendingDeliveries}
          icon={CheckCircle}
          sub="Deliveries in flight"
        />
        <KpiCard
          label="Terminal Failures"
          value={health.terminalFailures}
          icon={AlertTriangle}
          sub="Permanent delivery drops"
        />
      </div>

      <FilterBar action="/system/moderation-notifications">
        <SelectFilter
          name="status"
          label="Delivery Status"
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

      <DataTable data={items} columns={columns} empty="No moderation notification batches recorded." />
      <LoadMore basePath="/system/moderation-notifications" params={query} nextCursor={nextCursor} />
    </div>
  );
}
