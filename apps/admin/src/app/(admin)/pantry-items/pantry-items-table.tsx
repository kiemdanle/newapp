'use client';

import { useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { DiscardPantryItemModal } from './discard-pantry-item-modal';
import { DeletePantryItemModal } from './delete-pantry-item-modal';

interface PantryItemsTableProps {
  items: AdminPantryItemRow[];
  sortBy: string;
  sortOrder: string;
  queryParams: Record<string, string | undefined>;
}

export function PantryItemsTable({
  items,
  sortBy,
  sortOrder,
  queryParams,
}: PantryItemsTableProps) {
  const [discardTarget, setDiscardTarget] = useState<AdminPantryItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPantryItemRow | null>(null);

  const getSortUrl = (columnKey: string, defaultOrder: 'asc' | 'desc' = 'asc') => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '' && k !== 'sortBy' && k !== 'sortOrder') {
        sp.set(k, v);
      }
    }
    const isCurrent = sortBy === columnKey;
    const nextOrder = isCurrent ? (sortOrder === 'asc' ? 'desc' : 'asc') : defaultOrder;
    sp.set('sortBy', columnKey);
    sp.set('sortOrder', nextOrder);
    return `/pantry-items?${sp.toString()}`;
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown size={12} className="opacity-40" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} className="text-primary font-bold" />
    ) : (
      <ArrowDown size={12} className="text-primary font-bold" />
    );
  };

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
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                <Link
                  href={getSortUrl('name')}
                  className="inline-flex items-center gap-1.5 font-semibold hover:text-primary transition"
                >
                  <span>Item / Product</span>
                  {renderSortIcon('name')}
                </Link>
              </TableHead>
              <TableHead className="min-w-[130px]">Brand / Category</TableHead>
              <TableHead className="min-w-[170px]">Owner</TableHead>
              <TableHead className="min-w-[100px]">Location</TableHead>
              <TableHead className="min-w-[90px]">
                <Link
                  href={getSortUrl('quantity')}
                  className="inline-flex items-center gap-1.5 font-semibold hover:text-primary transition"
                >
                  <span>Quantity</span>
                  {renderSortIcon('quantity')}
                </Link>
              </TableHead>
              <TableHead className="min-w-[140px]">
                <Link
                  href={getSortUrl('expiryDate', 'asc')}
                  className="inline-flex items-center gap-1.5 font-semibold hover:text-primary transition"
                >
                  <span>Expiry & Status</span>
                  {renderSortIcon('expiryDate')}
                </Link>
              </TableHead>
              <TableHead className="min-w-[110px]">
                <Link
                  href={getSortUrl('createdAt', 'desc')}
                  className="inline-flex items-center gap-1.5 font-semibold hover:text-primary transition"
                >
                  <span>Added</span>
                  {renderSortIcon('createdAt')}
                </Link>
              </TableHead>
              <TableHead className="text-right min-w-[140px]">Actions</TableHead>
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
                <TableRow key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                  {/* Item / Product */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-500 overflow-hidden">
                        {item.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photoUrl}
                            alt={item.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/pantry-items/${item.id}`}
                          className="font-semibold text-neutral-dark hover:text-primary transition truncate block text-sm"
                        >
                          {item.displayName}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-mid mt-0.5">
                          {item.productBarcode ? (
                            <span className="font-mono bg-neutral-100 px-1.5 py-0.2 rounded text-[10px]">
                              {item.productBarcode}
                            </span>
                          ) : (
                            <span className="text-neutral-400">Custom manual item</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Brand & Category */}
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium text-neutral-dark truncate max-w-[130px]">
                        {item.brand || '—'}
                      </p>
                      <p className="text-[11px] text-neutral-mid truncate max-w-[130px]">
                        {item.category || '—'}
                      </p>
                    </div>
                  </TableCell>

                  {/* Owner */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light/50 text-[10px] font-bold text-primary-dark">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/users/${item.userId}`}
                          className="text-xs font-medium text-neutral-dark hover:text-primary transition truncate block"
                        >
                          {item.userEmail}
                        </Link>
                        <p className="text-[10px] text-neutral-mid truncate">
                          {item.userName}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    {item.location ? (
                      <span className="inline-flex items-center rounded-lg bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        {item.location}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </TableCell>

                  {/* Quantity */}
                  <TableCell>
                    <span className="text-xs font-semibold text-neutral-dark font-mono">
                      {item.quantity} <span className="font-normal text-neutral-mid">{item.unit}</span>
                    </span>
                  </TableCell>

                  {/* Expiry & Status */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-neutral-dark font-medium">
                        {item.expiryDate}
                      </div>
                      <div>{getStatusBadge(item.status, item.expiryDate)}</div>
                    </div>
                  </TableCell>

                  {/* Added date */}
                  <TableCell>
                    <span className="text-xs text-neutral-mid font-mono">
                      {item.createdAt.slice(0, 10)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View */}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-neutral-600 hover:text-primary hover:bg-primary-light/15 rounded-lg"
                        title="View details"
                      >
                        <Link href={`/pantry-items/${item.id}`}>
                          <Eye size={15} />
                        </Link>
                      </Button>

                      {/* Edit */}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-neutral-600 hover:text-primary hover:bg-primary-light/15 rounded-lg"
                        title="Edit item"
                      >
                        <Link href={`/pantry-items/${item.id}?edit=true`}>
                          <Edit2 size={15} />
                        </Link>
                      </Button>

                      {/* Discard (if not already discarded) */}
                      {item.status !== 'discarded' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDiscardTarget(item)}
                          className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                          title="Mark as discarded"
                        >
                          <Archive size={15} />
                        </Button>
                      )}

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        title="Delete item permanently"
                      >
                        <Trash2 size={15} />
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
