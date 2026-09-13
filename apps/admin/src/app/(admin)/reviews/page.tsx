import { REVIEW_RATING_METADATA } from '@expyrico/shared';
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
  buy_again: REVIEW_RATING_METADATA.buy_again.label,
  buy_again_on_sale: REVIEW_RATING_METADATA.buy_again_on_sale.label,
  wont_buy: REVIEW_RATING_METADATA.wont_buy.label,
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
        const rating = r.rating;
        const isBuyAgain = rating === 'buy_again';
        const isOnSale = rating === 'buy_again_on_sale';
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isBuyAgain
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                : isOnSale
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                  : 'bg-stone-100 text-neutral-dark border border-stone-200'
            }`}
          >
            {isBuyAgain ? (
              <ThumbsUp size={12} className="text-emerald-600" />
            ) : isOnSale ? (
              <Tag size={12} className="text-amber-600" />
            ) : (
              <ThumbsDown size={12} className="text-neutral-500" />
            )}
            <span>{RATING_LABEL[rating] ?? rating}</span>
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
            { value: 'buy_again', label: REVIEW_RATING_METADATA.buy_again.label },
            { value: 'buy_again_on_sale', label: REVIEW_RATING_METADATA.buy_again_on_sale.label },
            { value: 'wont_buy', label: REVIEW_RATING_METADATA.wont_buy.label },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No reviews match these filters." />
      <LoadMore basePath="/reviews" params={query} nextCursor={nextCursor} />
    </div>
  );
}
