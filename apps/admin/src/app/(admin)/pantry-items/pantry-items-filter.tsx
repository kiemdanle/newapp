'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';

interface PantryItemsFilterProps {
  locations: string[];
  categories: string[];
  brands: string[];
  values: {
    q?: string;
    location?: string;
    category?: string;
    brand?: string;
    productType?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: string;
  };
}

export function PantryItemsFilter({
  locations,
  categories,
  brands,
  values,
}: PantryItemsFilterProps) {
  const hasActiveFilters = Boolean(
    values.q ||
      values.location ||
      values.category ||
      values.brand ||
      (values.productType && values.productType !== 'all') ||
      (values.status && values.status !== 'all'),
  );

  return (
    <form
      method="get"
      action="/pantry-items"
      className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3"
    >
      {/* Hidden inputs to preserve sort and pagination size */}
      {values.limit && <input type="hidden" name="limit" value={values.limit} />}
      {values.sortBy && <input type="hidden" name="sortBy" value={values.sortBy} />}
      {values.sortOrder && <input type="hidden" name="sortOrder" value={values.sortOrder} />}

      <div className="flex flex-wrap items-end gap-3.5">
        {/* Search input */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[220px] flex-1">
          <span>Search</span>
          <div className="relative">
            <input
              type="text"
              name="q"
              defaultValue={values.q ?? ''}
              placeholder="Search by name, brand, user, barcode..."
              className="h-10 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm font-normal text-neutral-dark placeholder:text-neutral-mid/50 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
            />
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-mid/60"
            />
          </div>
        </label>

        {/* Location filter */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[140px]">
          <span>Location</span>
          <select
            name="location"
            defaultValue={values.location ?? ''}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>

        {/* Category filter */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[140px]">
          <span>Category</span>
          <select
            name="category"
            defaultValue={values.category ?? ''}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        {/* Brand filter */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[130px]">
          <span>Brand</span>
          <select
            name="brand"
            defaultValue={values.brand ?? ''}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        {/* Product Type filter */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[130px]">
          <span>Type</span>
          <select
            name="productType"
            defaultValue={values.productType ?? 'all'}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          >
            <option value="all">All Types</option>
            <option value="catalog">Catalog</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        {/* Status filter */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body min-w-[120px]">
          <span>Status</span>
          <select
            name="status"
            defaultValue={values.status ?? 'all'}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="consumed">Consumed</option>
            <option value="discarded">Discarded</option>
            <option value="expired">Expired</option>
          </select>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="h-10 px-4 rounded-xl gap-1.5 font-semibold bg-primary hover:bg-primary-dark text-white"
          >
            <Filter size={14} />
            <span>Apply</span>
          </Button>

          {hasActiveFilters && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-10 px-3 rounded-xl border-neutral-300 text-neutral-dark hover:border-red-300 hover:text-red-600 gap-1"
            >
              <Link href="/pantry-items">
                <X size={14} />
                <span>Reset</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
