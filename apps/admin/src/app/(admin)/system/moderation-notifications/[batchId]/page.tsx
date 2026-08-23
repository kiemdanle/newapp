import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';

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
    { header: 'Channel', cell: (delivery) => delivery.channel },
    { header: 'Status', cell: (delivery) => <StatusBadge status={delivery.status} /> },
    { header: 'Attempts', cell: (delivery) => delivery.attempts },
    { header: 'Token outcomes', cell: (delivery) => delivery.tokenSummary ? `Sent ${delivery.tokenSummary.sent}, invalid ${delivery.tokenSummary.invalid}, failed ${delivery.tokenSummary.failed}` : '—' },
    { header: 'Completed', cell: (delivery) => delivery.completedAt ? new Date(delivery.completedAt).toLocaleString() : '—' },
    { header: 'Error', cell: (delivery) => delivery.errorMessage ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/system/moderation-notifications" className="text-sm font-semibold text-primary-dark hover:underline">← Moderation notifications</Link>
        <h1 className="mt-2 text-[28px] font-semibold text-neutral-dark font-display">Batch delivery outcomes</h1>
        <p className="mt-1 text-sm text-neutral-mid">Recipient identities and device tokens are not displayed.</p>
      </div>
      <FilterBar action={`/system/moderation-notifications/${batchId}`}>
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
      <DataTable data={page.items} columns={columns} empty="No delivery outcomes match these filters." />
      <LoadMore basePath={`/system/moderation-notifications/${batchId}`} params={query} nextCursor={page.nextCursor} />
    </div>
  );
}
