import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';

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
      header: 'Review',
      cell: (r) => (
        <Link href={`/reviews/${r.id}`} className="font-medium hover:underline">
          {r.comment ? r.comment.slice(0, 60) : '(no comment)'}
        </Link>
      ),
    },
    { header: 'Rating', cell: (r) => RATING_LABEL[r.rating] ?? r.rating },
    { header: 'Helpful', cell: (r) => `${r.helpfulCount} / ${r.notHelpfulCount}` },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Created', cell: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Reviews</h1>
      <FilterBar action="/reviews">
        <SelectFilter
          name="status"
          label="Status"
          value={sp.status}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        <SelectFilter
          name="rating"
          label="Rating"
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
