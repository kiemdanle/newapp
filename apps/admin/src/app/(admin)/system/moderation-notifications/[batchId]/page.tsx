import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { ArrowLeft, Bell } from 'lucide-react';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.moderationNotifications.deliveries>>['items'][number];

export default async function ModerationNotificationBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { batchId } = await params;
  const sp = await searchParams;
  const query = { status: sp.status, cursor: sp.cursor };
  let page: Awaited<ReturnType<typeof serverAdminApi.system.moderationNotifications.deliveries>>;
  try {
    page = await serverAdminApi.system.moderationNotifications.deliveries(batchId, query);
  } catch {
    notFound();
  }

  const columns: Column<Row>[] = [
    {
      header: 'Delivery Channel',
      cell: (delivery) => (
        <span className="font-semibold text-neutral-dark text-xs uppercase bg-neutral-light px-2 py-0.5 rounded-md border border-neutral-200">
          {delivery.channel}
        </span>
      ),
    },
    { header: 'Status', cell: (delivery) => <StatusBadge status={delivery.status} /> },
    {
      header: 'Attempts',
      cell: (delivery) => (
        <span className="text-xs font-mono font-medium text-neutral-dark">
          {delivery.attempts}
        </span>
      ),
    },
    {
      header: 'Token Summary',
      cell: (delivery) =>
        delivery.tokenSummary ? (
          <div className="text-xs text-neutral-mid space-x-2">
            <span>Sent: <strong className="text-emerald-700 font-mono">{delivery.tokenSummary.sent}</strong></span>
            <span>Invalid: <strong className="text-amber-700 font-mono">{delivery.tokenSummary.invalid}</strong></span>
            <span>Failed: <strong className="text-red-700 font-mono">{delivery.tokenSummary.failed}</strong></span>
          </div>
        ) : (
          <span className="text-neutral-mid text-xs">—</span>
        ),
    },
    {
      header: 'Completed At',
      cell: (delivery) => (
        <span className="text-xs text-neutral-mid font-mono">
          {delivery.completedAt ? new Date(delivery.completedAt).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      header: 'Error Log',
      cell: (delivery) => (
        <span className="text-xs text-neutral-mid max-w-sm truncate block">
          {delivery.errorMessage ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Back Link & Header */}
      <div className="space-y-3">
        <Link
          href="/system/moderation-notifications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to moderation notifications</span>
        </Link>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Bell size={14} />
            <span>Batch Details</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Batch Delivery Outcomes
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Audit channel outcomes and token dispatch statistics for batch <span className="font-mono text-neutral-dark text-xs">{batchId}</span>.
          </p>
        </div>
      </div>

      <FilterBar action={`/system/moderation-notifications/${batchId}`}>
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

      <DataTable data={page.items} columns={columns} empty="No delivery outcomes match these filters." />
      <LoadMore
        basePath={`/system/moderation-notifications/${batchId}`}
        params={query}
        nextCursor={page.nextCursor}
      />
    </div>
  );
}
