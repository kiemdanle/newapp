import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.products.list>>['items'][number];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { q: sp.q, status: sp.status, source: sp.source, cursor: sp.cursor };
  const { items, nextCursor } = await serverAdminApi.products.list(query);

  const columns: Column<Row>[] = [
    {
      header: 'Name',
      cell: (p) => (
        <Link href={`/products/${p.id}`} className="font-medium hover:underline">
          {p.name}
        </Link>
      ),
    },
    { header: 'Brand', cell: (p) => p.brand ?? '—' },
    { header: 'Barcode', cell: (p) => p.barcode ?? '—' },
    { header: 'Source', cell: (p) => p.source },
    { header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { header: 'Reviews', cell: (p) => p.reviewCount },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Products</h1>
      <FilterBar action="/products">
        <TextFilter name="q" label="Search" value={sp.q} placeholder="name, brand, barcode" />
        <SelectFilter
          name="status"
          label="Status"
          value={sp.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'merged_into', label: 'Merged' },
          ]}
        />
        <SelectFilter
          name="source"
          label="Source"
          value={sp.source}
          options={[
            { value: 'off', label: 'OpenFoodFacts' },
            { value: 'upcitemdb', label: 'UPCitemdb' },
            { value: 'user', label: 'User' },
          ]}
        />
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No products match these filters." />
      <LoadMore basePath="/products" params={query} nextCursor={nextCursor} />
    </div>
  );
}
