import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { MessageSquare, ThumbsUp, Tag, ThumbsDown, ThumbsUp as HelpfulIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.reviews.list>>['items'][number];

const RATING_LABEL: Record<string, string> = {
  '5': '5 Stars ★★★★★',
  '4': '4 Stars ★★★★☆',
  '3': '3 Stars ★★★☆☆',
  '2': '2 Stars ★★☆☆☆',
  '1': '1 Star ★☆☆☆☆',
  buy_again: '5 Stars ★★★★★',
  buy_again_on_sale: '3 Stars ★★★☆☆',
  wont_buy: '1 Star ★☆☆☆☆',
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { status: sp.status, rating: sp.rating, cursor: sp.cursor };
  const { items, nextCursor } = await serverAdminApi.reviews.list(query);

  const columns: Column<Row>[] = [
    {
      header: 'Review Content',
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <Link
            href={`/reviews/${r.id}`}
            className="font-semibold text-neutral-dark hover:text-primary transition-colors line-clamp-2"
          >
            {r.comment || <span className="italic text-neutral-mid">(No written comment provided)</span>}
          </Link>
        </div>
      ),
    },
    {
      header: 'Star Rating',
      cell: (r) => {
        const stars = (r as any).stars ?? (r.rating === 'buy_again' ? 5 : r.rating === 'buy_again_on_sale' ? 3 : r.rating === 'wont_buy' ? 1 : Number(r.rating) || 5);
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              stars >= 4
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                : stars === 3
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                  : 'bg-stone-100 text-neutral-dark border border-stone-200'
            }`}
          >
            <span className="text-amber-500">{'★'.repeat(stars)}</span>
            <span className="text-neutral-300">{'☆'.repeat(5 - stars)}</span>
            <span className="ml-1 font-bold">{stars}.0</span>
          </span>
        );
      },
    },
    {
      header: 'Helpful Votes',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs text-neutral-dark font-medium">
          <HelpfulIcon size={12} className="text-primary" />
          <span>{r.helpfulCount}</span>
          <span className="text-neutral-mid">/ {r.notHelpfulCount}</span>
        </span>
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
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <MessageSquare size={14} />
          <span>Community Feedback</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Product Reviews Moderation
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Inspect user reviews, sentiment distributions, and take moderation actions on flagged items.
        </p>
      </div>

      <FilterBar action="/reviews">
        <SelectFilter
          name="status"
          label="Moderation Status"
          value={sp.status}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        <SelectFilter
          name="rating"
          label="Star Rating"
          value={sp.rating}
          options={[
            { value: '5', label: '5 Stars ★★★★★' },
            { value: '4', label: '4 Stars ★★★★☆' },
            { value: '3', label: '3 Stars ★★★☆☆' },
            { value: '2', label: '2 Stars ★★☆☆☆' },
            { value: '1', label: '1 Star ★☆☆☆☆' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No reviews match these filters." />
      <LoadMore basePath="/reviews" params={query} nextCursor={nextCursor} />
    </div>
  );
}
