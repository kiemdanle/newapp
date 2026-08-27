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
  buy_again: 'Buy again',
  buy_again_on_sale: 'Buy again on sale',
  wont_buy: "Won't buy",
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
      header: 'Sentiment / Rating',
      cell: (r) => {
        const isGood = r.rating === 'buy_again';
        const isSale = r.rating === 'buy_again_on_sale';
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isGood
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                : isSale
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                  : 'bg-red-50 text-red-800 border border-red-200/80'
            }`}
          >
            {isGood && <ThumbsUp size={12} className="text-emerald-600" />}
            {isSale && <Tag size={12} className="text-amber-600" />}
            {!isGood && !isSale && <ThumbsDown size={12} className="text-red-600" />}
            <span>{RATING_LABEL[r.rating] ?? r.rating}</span>
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
          label="Purchase Sentiment"
          value={sp.rating}
          options={[
            { value: 'buy_again', label: 'Buy again' },
            { value: 'buy_again_on_sale', label: 'Buy again on sale' },
            { value: 'wont_buy', label: "Won't buy" },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No reviews match these filters." />
      <LoadMore basePath="/reviews" params={query} nextCursor={nextCursor} />
    </div>
  );
}
