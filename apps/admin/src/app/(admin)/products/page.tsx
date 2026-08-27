import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';
import { Package, Clock, ExternalLink } from 'lucide-react';

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
      header: 'Product',
      cell: (p) => (
        <div className="flex items-center gap-3">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-10 w-10 shrink-0 rounded-xl border border-neutral-200 object-cover bg-white"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-light text-neutral-mid/70 border border-neutral-200">
              <Package size={18} />
            </div>
          )}
          <div className="min-w-0">
            <Link
              href={`/products/${p.id}`}
              className="font-semibold text-neutral-dark hover:text-primary transition-colors line-clamp-1"
            >
              {p.name}
            </Link>
            {p.brand && <p className="text-xs text-neutral-mid truncate">{p.brand}</p>}
          </div>
        </div>
      ),
    },
    {
      header: 'Barcode / ID',
      cell: (p) => (
        <span className="font-mono text-xs text-neutral-mid">
          {p.barcode ? (
            <span className="rounded-md bg-neutral-light px-2 py-0.5 text-neutral-dark font-medium">
              {p.barcode}
            </span>
          ) : (
            '—'
          )}
        </span>
      ),
    },
    {
      header: 'Source',
      cell: (p) => (
        <span className="inline-flex items-center rounded-md bg-neutral-light px-2 py-0.5 text-xs font-medium text-neutral-dark uppercase">
          {p.source}
        </span>
      ),
    },
    {
      header: 'Creator',
      cell: (p) => {
        if (!p.creator) return <span className="text-xs text-neutral-mid">—</span>;
        const name = `${p.creator.firstName} ${p.creator.lastName}`.trim() || p.creator.email;
        return (
          <span className="text-xs">
            <span className="font-medium text-neutral-dark">{name}</span>
            {p.creator.email && name !== p.creator.email && (
              <span className="text-neutral-mid block text-[11px] truncate max-w-[140px]">
                {p.creator.email}
              </span>
            )}
          </span>
        );
      },
    },
    { header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    {
      header: 'Reviews',
      cell: (p) => (
        <span className="text-xs font-semibold text-neutral-dark">
          {p.reviewCount} <span className="font-normal text-neutral-mid">reviews</span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Package size={14} />
            <span>Catalog Directory</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Products Catalog
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Search, inspect, and manage active, pending, and merged product catalog entries.
          </p>
        </div>

        <Link
          href="/products/pending"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-neutral-dark shadow-xs hover:border-primary hover:text-primary transition-all self-start sm:self-auto"
        >
          <Clock size={16} />
          <span>Pending approval queue</span>
          <ExternalLink size={14} className="text-neutral-mid" />
        </Link>
      </div>

      {/* Filter bar */}
      <FilterBar action="/products">
        <TextFilter name="q" label="Search query" value={sp.q} placeholder="Product name, brand, or barcode…" />
        <SelectFilter
          name="status"
          label="Catalog Status"
          value={sp.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'merged_into', label: 'Merged' },
          ]}
        />
        <SelectFilter
          name="source"
          label="Data Source"
          value={sp.source}
          options={[
            { value: 'off', label: 'OpenFoodFacts' },
            { value: 'upcitemdb', label: 'UPCitemdb' },
            { value: 'user', label: 'User Submitted' },
          ]}
        />
      </FilterBar>

      {/* Data table */}
      <DataTable data={items} columns={columns} empty="No products match your search filters." />
      <LoadMore basePath="/products" params={query} nextCursor={nextCursor} />
    </div>
  );
}
