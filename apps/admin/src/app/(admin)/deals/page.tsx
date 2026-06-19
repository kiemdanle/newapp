import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { DealActions } from './deal-actions';

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
      header: 'Product',
      cell: (r) => (
        <span className="font-medium">
          {r.productName}
          {r.productBrand ? <span className="text-muted-foreground"> · {r.productBrand}</span> : null}
        </span>
      ),
    },
    {
      header: 'Price',
      cell: (r) => `${r.currency} ${r.price.toFixed(2)}`,
    },
    { header: 'Store', cell: (r) => r.storeName },
    { header: 'Author', cell: (r) => r.authorFirstName },
    {
      header: 'Votes',
      cell: (r) => (
        <span>
          ▲{r.upvoteCount} ▼{r.downvoteCount} <span className="text-muted-foreground">({r.score.toFixed(4)})</span>
        </span>
      ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Created',
      cell: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      header: 'Actions',
      cell: (r) => <DealActions id={r.id} status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Deals</h1>
      <FilterBar action="/deals">
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
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No deals match these filters." />
      <LoadMore basePath="/deals" params={query} nextCursor={nextCursor} />
    </div>
  );
}
