import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { DealActions } from './deal-actions';
import { Tag, ThumbsUp, ThumbsDown, Store } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.deals.list>>['items'][number];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { status: sp.status, cursor: sp.cursor };
  const { items, nextCursor } = await serverAdminApi.deals.list(query);

  const columns: Column<Row>[] = [
    {
      header: 'Deal Product',
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <span className="font-semibold text-neutral-dark line-clamp-1">
            {r.productName}
          </span>
          {r.productBrand && (
            <p className="text-xs text-neutral-mid truncate">{r.productBrand}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Deal Price',
      cell: (r) => (
        <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800 font-mono">
          {r.currency} {r.price.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Store / Location',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-dark">
          <Store size={12} className="text-neutral-mid" />
          <span>{r.storeName}</span>
        </span>
      ),
    },
    {
      header: 'Shared By',
      cell: (r) => (
        <span className="text-xs font-medium text-neutral-dark">
          {r.authorFirstName || 'Anonymous user'}
        </span>
      ),
    },
    {
      header: 'Community Score',
      cell: (r) => (
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
            <ThumbsUp size={11} />
            <span>{r.upvoteCount}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold">
            <ThumbsDown size={11} />
            <span>{r.downvoteCount}</span>
          </span>
          <span className="text-neutral-mid font-mono text-[11px]">({r.score.toFixed(2)})</span>
        </div>
      ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Created',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (r) => <DealActions id={r.id} status={r.status} />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Tag size={14} />
          <span>Community Deals</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Deals Management
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Moderate community discount submissions, store pricing, and vote scoring.
        </p>
      </div>

      <FilterBar action="/deals">
        <SelectFilter
          name="status"
          label="Deal Status"
          value={sp.status}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No deals match these filters." />
      <LoadMore basePath="/deals" params={query} nextCursor={nextCursor} />
    </div>
  );
}
