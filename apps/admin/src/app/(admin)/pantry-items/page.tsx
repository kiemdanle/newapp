import { notFound } from 'next/navigation';
import { serverAdminApi } from '@/lib/admin-api';
import { PantryItemsFilter } from './pantry-items-filter';
import { PantryItemsTable } from './pantry-items-table';
import { Pagination } from '@/components/pagination';
import { Archive, Layers, ListFilter } from 'lucide-react';

export default async function PantryItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Admin access to pantry items is restricted / denied (404 hides existence).
  // All original functions, table, filter, and pagination components remain intact below.
  const ALLOW_ADMIN_PANTRY_ITEMS = false;
  if (!ALLOW_ADMIN_PANTRY_ITEMS) {
    notFound();
  }

  const sp = await searchParams;

  const query = {
    q: sp.q,
    location: sp.location,
    category: sp.category,
    brand: sp.brand,
    productType: sp.productType,
    productId: sp.productId,
    userId: sp.userId,
    status: sp.status,
    sortBy: sp.sortBy,
    sortOrder: sp.sortOrder,
    page: sp.page,
    limit: sp.limit,
  };

  const [data, filterOptions] = await Promise.all([
    serverAdminApi.pantryItems.list(query),
    serverAdminApi.pantryItems.filterOptions().catch(() => ({
      locations: [],
      categories: [],
      brands: [],
    })),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light/60 text-primary-dark">
              <Archive size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-dark font-display">
                Pantry Items
              </h1>
              <p className="text-xs text-neutral-mid mt-0.5">
                Manage, search, filter, and inspect user pantry items across the entire platform.
              </p>
            </div>
          </div>
        </div>

        {/* Quick summary metrics */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-card">
            <Layers size={14} className="text-primary" />
            <span className="text-neutral-mid">Total Matching:</span>
            <strong className="font-semibold text-neutral-dark">{data.total}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-card">
            <ListFilter size={14} className="text-primary" />
            <span className="text-neutral-mid">Page:</span>
            <strong className="font-semibold text-neutral-dark">
              {data.page} / {data.totalPages}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <PantryItemsFilter
        locations={filterOptions.locations}
        categories={filterOptions.categories}
        brands={filterOptions.brands}
        values={sp}
      />

      {/* Table view */}
      <PantryItemsTable
        items={data.items}
        sortBy={sp.sortBy ?? 'expiryDate'}
        sortOrder={sp.sortOrder ?? 'asc'}
        queryParams={sp}
      />

      {/* Pagination controls */}
      <Pagination
        currentPage={data.page}
        totalPages={data.totalPages}
        totalItems={data.total}
        pageSize={data.limit}
        basePath="/pantry-items"
        queryParams={sp}
      />
    </div>
  );
}
