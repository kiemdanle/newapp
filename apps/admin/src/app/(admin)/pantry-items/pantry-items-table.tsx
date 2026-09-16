'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminPantryItemRow } from '@expyrico/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit2,
  Trash2,
  Archive,
  Package,
  Inbox,
  Filter,
  Check,
  X,
} from 'lucide-react';
import { DiscardPantryItemModal } from './discard-pantry-item-modal';
import { DeletePantryItemModal } from './delete-pantry-item-modal';

interface PantryItemsTableProps {
  items: AdminPantryItemRow[];
  sortBy: string;
  sortOrder: string;
  queryParams: Record<string, string | undefined>;
}

interface ColumnDropdownProps {
  title: string;
  columnKey: string;
  sortable?: boolean | undefined;
  sortBy?: string | undefined;
  sortOrder?: string | undefined;
  filterParamName: string;
  filterPlaceholder: string;
  currentFilterValue?: string | undefined;
  queryParams: Record<string, string | undefined>;
  sortAscLabel?: string | undefined;
  sortDescLabel?: string | undefined;
}

function ColumnHeaderDropdown({
  title,
  columnKey,
  sortable = true,
  sortBy,
  sortOrder,
  filterParamName,
  filterPlaceholder,
  currentFilterValue,
  queryParams,
  sortAscLabel = 'Sort Ascending (A-Z)',
  sortDescLabel = 'Sort Descending (Z-A)',
}: ColumnDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filterInput, setFilterInput] = useState(currentFilterValue ?? '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if prop changes
  useEffect(() => {
    setFilterInput(currentFilterValue ?? '');
  }, [currentFilterValue]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isSorted = sortBy === columnKey;
  const isFiltered = Boolean(currentFilterValue && currentFilterValue.trim().length > 0);

  const handleSort = (order: 'asc' | 'desc') => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '' && k !== 'sortBy' && k !== 'sortOrder') {
        sp.set(k, v);
      }
    }
    sp.set('sortBy', columnKey);
    sp.set('sortOrder', order);
    router.push(`/pantry-items?${sp.toString()}`);
    setIsOpen(false);
  };

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '' && k !== filterParamName && k !== 'page') {
        sp.set(k, v);
      }
    }
    if (filterInput.trim()) {
      sp.set(filterParamName, filterInput.trim());
    }
    sp.set('page', '1');
    router.push(`/pantry-items?${sp.toString()}`);
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    setFilterInput('');
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '' && k !== filterParamName && k !== 'page') {
        sp.set(k, v);
      }
    }
    sp.set('page', '1');
    router.push(`/pantry-items?${sp.toString()}`);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative inline-flex items-center justify-center">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer select-none ${
          isSorted || isFiltered
            ? 'text-primary bg-primary-light/25 hover:bg-primary-light/40'
            : 'text-neutral-dark hover:text-primary hover:bg-neutral-100'
        }`}
        title={`Sort & filter ${title}`}
      >
        <span>{title}</span>

        {/* Sort indicator */}
        {sortable && (
          <span className="shrink-0">
            {isSorted ? (
              sortOrder === 'asc' ? (
                <ArrowUp size={12} className="text-primary font-bold" />
              ) : (
                <ArrowDown size={12} className="text-primary font-bold" />
              )
            ) : (
              <ArrowUpDown size={11} className="opacity-40" />
            )}
          </span>
        )}

        {/* Filter active badge */}
        {isFiltered && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-primary/20 shrink-0" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 w-64 rounded-2xl border border-border bg-card p-3 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-[11px] font-semibold text-neutral-mid uppercase tracking-wide">
              {title} Options
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 rounded p-0.5"
            >
              <X size={13} />
            </button>
          </div>

          {/* Sort Options */}
          {sortable && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Sort
              </span>
              <div className="grid grid-cols-1 gap-1">
                <button
                  type="button"
                  onClick={() => handleSort('asc')}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs transition text-left ${
                    isSorted && sortOrder === 'asc'
                      ? 'bg-primary-light/50 text-primary-dark font-semibold'
                      : 'hover:bg-neutral-50 text-neutral-dark'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowUp size={13} className="text-primary" />
                    <span>{sortAscLabel}</span>
                  </span>
                  {isSorted && sortOrder === 'asc' && <Check size={12} className="text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSort('desc')}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs transition text-left ${
                    isSorted && sortOrder === 'desc'
                      ? 'bg-primary-light/50 text-primary-dark font-semibold'
                      : 'hover:bg-neutral-50 text-neutral-dark'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowDown size={13} className="text-primary" />
                    <span>{sortDescLabel}</span>
                  </span>
                  {isSorted && sortOrder === 'desc' && <Check size={12} className="text-primary" />}
                </button>
              </div>
            </div>
          )}

          {/* Filter Input */}
          <form onSubmit={handleApplyFilter} className="space-y-2 pt-1 border-t border-neutral-100">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Filter Text
            </span>
            <input
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder={filterPlaceholder}
              autoFocus
              className="h-8 w-full rounded-xl border border-neutral-300 bg-white px-2.5 text-xs text-neutral-dark placeholder:text-neutral-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
            />

            <div className="flex items-center justify-between gap-1.5 pt-1">
              {isFiltered || filterInput ? (
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="text-[11px] text-neutral-500 hover:text-red-600 transition font-medium"
                >
                  Clear Filter
                </button>
              ) : (
                <span />
              )}

              <Button
                type="submit"
                size="sm"
                variant="default"
                className="h-7 px-3 rounded-lg text-[11px] font-semibold bg-primary hover:bg-primary-dark text-white shadow-xs"
              >
                Apply
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PantryItemsTable({
  items,
  sortBy,
  sortOrder,
  queryParams,
}: PantryItemsTableProps) {
  const [discardTarget, setDiscardTarget] = useState<AdminPantryItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPantryItemRow | null>(null);

  const getStatusBadge = (status: string, expiryDate: string) => {
    switch (status) {
      case 'active': {
        const today = new Date().toISOString().slice(0, 10);
        const isExpiringSoon = expiryDate <= today;
        return isExpiringSoon ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Expiring / Expired
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Active
          </span>
        );
      }
      case 'consumed':
        return (
          <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            Consumed
          </span>
        );
      case 'discarded':
        return (
          <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            Discarded
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
            {status}
          </span>
        );
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-card">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-light/70 text-neutral-mid/80">
          <Inbox size={24} />
        </div>
        <p className="text-sm font-semibold text-neutral-dark">No pantry items found.</p>
        <p className="mt-1 text-xs text-neutral-mid">No records match your active search and filter criteria.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="border-b border-neutral-200 bg-neutral-50/50">
              {/* Item / Product */}
              <TableHead className="w-[26%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Item / Product"
                  columnKey="name"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  filterParamName="q"
                  filterPlaceholder="Search item or barcode..."
                  currentFilterValue={queryParams.q}
                  queryParams={queryParams}
                  sortAscLabel="Name (A to Z)"
                  sortDescLabel="Name (Z to A)"
                />
              </TableHead>

              {/* Brand & Category */}
              <TableHead className="w-[16%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Brand / Category"
                  columnKey="brand"
                  sortable={false}
                  filterParamName="brand"
                  filterPlaceholder="Filter by brand..."
                  currentFilterValue={queryParams.brand}
                  queryParams={queryParams}
                />
              </TableHead>

              {/* Owner */}
              <TableHead className="w-[21%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Owner"
                  columnKey="owner"
                  sortable={false}
                  filterParamName="q"
                  filterPlaceholder="Filter owner email..."
                  currentFilterValue={queryParams.q}
                  queryParams={queryParams}
                />
              </TableHead>

              {/* Quantity */}
              <TableHead className="w-[11%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Quantity"
                  columnKey="quantity"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  filterParamName="q"
                  filterPlaceholder="Filter quantity..."
                  currentFilterValue={queryParams.q}
                  queryParams={queryParams}
                  sortAscLabel="Lowest first"
                  sortDescLabel="Highest first"
                />
              </TableHead>

              {/* Expiry & Status */}
              <TableHead className="w-[15%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Expiry & Status"
                  columnKey="expiryDate"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  filterParamName="status"
                  filterPlaceholder="active, expired..."
                  currentFilterValue={queryParams.status !== 'all' ? queryParams.status : undefined}
                  queryParams={queryParams}
                  sortAscLabel="Expiring soonest"
                  sortDescLabel="Expiring latest"
                />
              </TableHead>

              {/* Added */}
              <TableHead className="w-[11%] text-center py-3 px-2">
                <ColumnHeaderDropdown
                  title="Added"
                  columnKey="createdAt"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  filterParamName="q"
                  filterPlaceholder="Filter date..."
                  currentFilterValue={queryParams.q}
                  queryParams={queryParams}
                  sortAscLabel="Oldest first"
                  sortDescLabel="Newest first"
                />
              </TableHead>

              {/* Actions */}
              <TableHead className="w-[90px] text-center font-semibold text-neutral-dark text-xs py-3 px-2">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const initials = item.userName
                ? item.userName
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U';

              return (
                <TableRow key={item.id} className="hover:bg-neutral-50/70 transition-colors border-b border-neutral-100 last:border-0">
                  {/* Item / Product with Truncation & Hover Tooltip */}
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-500 overflow-hidden">
                        {item.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photoUrl}
                            alt={item.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package size={17} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Hover Tooltip container */}
                        <div className="relative group/name inline-block max-w-full">
                          <Link
                            href={`/pantry-items/${item.id}`}
                            title={item.displayName}
                            className="truncate block text-xs font-semibold text-neutral-dark hover:text-primary transition max-w-[150px] sm:max-w-[170px] xl:max-w-[210px]"
                          >
                            {item.displayName}
                          </Link>

                          {/* Floating Tooltip showing full untruncated name */}
                          <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/name:flex flex-col z-50 pointer-events-none whitespace-normal min-w-[180px] max-w-xs rounded-xl bg-neutral-900/95 backdrop-blur-xs px-3 py-2 text-xs text-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
                            <span className="font-semibold leading-snug">{item.displayName}</span>
                            {item.customName && item.productName && (
                              <span className="text-[10px] text-neutral-300 mt-1 block">
                                Catalog Product: {item.productName}
                              </span>
                            )}
                            {item.brand && (
                              <span className="text-[10px] text-neutral-400 block mt-0.5">
                                Brand: {item.brand}
                              </span>
                            )}
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-neutral-900/95" />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-neutral-mid mt-0.5">
                          {item.productBarcode ? (
                            <span className="font-mono bg-neutral-100 px-1 py-0.2 rounded text-[10px] text-neutral-600 truncate max-w-[120px]">
                              {item.productBarcode}
                            </span>
                          ) : (
                            <span className="text-neutral-400">Custom</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Brand & Category (Centered) */}
                  <TableCell className="text-center py-2.5 px-2">
                    <div className="text-xs space-y-0.5 mx-auto max-w-[120px]">
                      <p className="font-medium text-neutral-dark truncate" title={item.brand || undefined}>
                        {item.brand || '—'}
                      </p>
                      <p className="text-[11px] text-neutral-mid truncate" title={item.category || undefined}>
                        {item.category || '—'}
                      </p>
                    </div>
                  </TableCell>

                  {/* Owner (Centered) */}
                  <TableCell className="text-center py-2.5 px-2">
                    <div className="flex items-center justify-center gap-2 mx-auto max-w-[170px]">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light/50 text-[9px] font-bold text-primary-dark">
                        {initials}
                      </div>
                      <div className="min-w-0 text-left">
                        <Link
                          href={`/users/${item.userId}`}
                          title={item.userEmail}
                          className="text-xs font-medium text-neutral-dark hover:text-primary transition truncate block max-w-[120px]"
                        >
                          {item.userEmail}
                        </Link>
                        <p className="text-[10px] text-neutral-mid truncate max-w-[120px]" title={item.userName}>
                          {item.userName}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Quantity (Centered) */}
                  <TableCell className="text-center py-2.5 px-2">
                    <span className="text-xs font-semibold text-neutral-dark font-mono">
                      {item.quantity} <span className="font-normal text-[11px] text-neutral-mid">{item.unit}</span>
                    </span>
                  </TableCell>

                  {/* Expiry & Status (Centered) */}
                  <TableCell className="text-center py-2.5 px-2">
                    <div className="space-y-1 mx-auto">
                      <div className="font-mono text-xs text-neutral-dark font-medium">
                        {item.expiryDate}
                      </div>
                      <div>{getStatusBadge(item.status, item.expiryDate)}</div>
                    </div>
                  </TableCell>

                  {/* Added date (Centered) */}
                  <TableCell className="text-center py-2.5 px-2">
                    <span className="text-xs text-neutral-mid font-mono">
                      {item.createdAt.slice(0, 10)}
                    </span>
                  </TableCell>

                  {/* Actions (Centered) */}
                  <TableCell className="text-center py-2.5 px-1">
                    <div className="flex items-center justify-center gap-0.5 mx-auto">
                      {/* View */}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-neutral-600 hover:text-primary hover:bg-primary-light/15 rounded-lg"
                        title="View details"
                      >
                        <Link href={`/pantry-items/${item.id}`}>
                          <Eye size={14} />
                        </Link>
                      </Button>

                      {/* Edit */}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-neutral-600 hover:text-primary hover:bg-primary-light/15 rounded-lg"
                        title="Edit item"
                      >
                        <Link href={`/pantry-items/${item.id}?edit=true`}>
                          <Edit2 size={14} />
                        </Link>
                      </Button>

                      {/* Discard (if not already discarded) */}
                      {item.status !== 'discarded' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDiscardTarget(item)}
                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                          title="Mark as discarded"
                        >
                          <Archive size={14} />
                        </Button>
                      )}

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        title="Delete item permanently"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Discard Modal */}
      {discardTarget && (
        <DiscardPantryItemModal
          item={discardTarget}
          onClose={() => setDiscardTarget(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeletePantryItemModal
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
