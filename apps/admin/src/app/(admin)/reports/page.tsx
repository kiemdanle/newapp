import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { Flag, ArrowRight, Tag } from 'lucide-react';

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
      header: 'Reported Target',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-neutral-light px-2 py-0.5 text-xs font-semibold text-neutral-dark uppercase">
            {r.targetType}
          </span>
          <Link
            href={`/reports/${r.id}`}
            className="inline-flex items-center gap-1 font-semibold text-neutral-dark hover:text-primary transition-colors text-xs"
          >
            <span>Inspect report</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ),
    },
    {
      header: 'Report Reason',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold">
          <Tag size={11} className="text-amber-600" />
          <span className="capitalize">{r.reason}</span>
        </span>
      ),
    },
    {
      header: 'Report Details',
      cell: (r) => (
        <div className="max-w-md truncate text-xs text-neutral-dark">
          {r.body || <span className="italic text-neutral-mid">—</span>}
        </div>
      ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Reported At',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Flag size={14} />
          <span>Trust & Safety</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          User Reports
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Triage and resolve abuse, spam, and incorrect content reports submitted by community members.
        </p>
      </div>

      <FilterBar action="/reports">
        <SelectFilter
          name="status"
          label="Report Status"
          value={query.status}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'dismissed', label: 'Dismissed' },
          ]}
        />
        <SelectFilter
          name="targetType"
          label="Target Type"
          value={sp.targetType}
          options={[
            { value: 'review', label: 'Review' },
            { value: 'user', label: 'User' },
            { value: 'product', label: 'Product' },
            { value: 'deal', label: 'Deal' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No user reports match these criteria." />
      <LoadMore basePath="/reports" params={query} nextCursor={nextCursor} />
    </div>
  );
}
