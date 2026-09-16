import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdminPantryItemDetail } from '@expyrico/shared';
import { serverAdminApi } from '@/lib/admin-api';
import { PantryItemGallery } from './pantry-item-gallery';
import { PantryItemDetailActions } from './pantry-item-detail-actions';
import {
  ArrowLeft,
  User as UserIcon,
  Package,
  Home,
  Clock,
  Bell,
  CheckCircle,
  Calendar,
  Layers,
  MapPin,
  Store,
  DollarSign,
  FileText,
} from 'lucide-react';

export default async function PantryItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Admin access to pantry items is restricted / denied (404 hides existence).
  // All original functions, gallery, modal, and action components remain intact below.
  const ALLOW_ADMIN_PANTRY_ITEMS = false;
  if (!ALLOW_ADMIN_PANTRY_ITEMS) {
    notFound();
  }

  const { id } = await params;
  const sp = await searchParams;

  let item: AdminPantryItemDetail;
  try {
    item = await serverAdminApi.pantryItems.get(id);
  } catch {
    notFound();
  }

  const userInitials = item.user.firstName
    ? `${item.user.firstName[0]}${item.user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = item.expiryDate <= today && item.status === 'active';

  const getStatusBadge = () => {
    switch (item.status) {
      case 'active':
        return isExpired ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
            Active (Expired)
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            Active
          </span>
        );
      case 'consumed':
        return (
          <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600">
            Consumed
          </span>
        );
      case 'discarded':
        return (
          <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
            Discarded
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900">
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Navigation */}
      <div>
        <Link
          href="/pantry-items"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Pantry Items</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-dark font-display">
              {item.displayName}
            </h1>
            {getStatusBadge()}
            {item.location && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                <MapPin size={12} className="text-emerald-700" />
                <span>{item.location}</span>
              </span>
            )}
            {item.productBarcode && (
              <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                {item.productBarcode}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-mid">
            Owner:{' '}
            <strong className="text-neutral-dark font-semibold">{item.user.email}</strong>
            {' · '}
            Added on {item.createdAt.slice(0, 10)}
          </p>
        </div>

        {/* Action triggers */}
        <PantryItemDetailActions item={item} initialEditOpen={sp.edit === 'true'} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-neutral-dark uppercase tracking-wider text-[11px]">
              Item Photos
            </h2>
            <PantryItemGallery
              photos={
                item.photoUrls.length > 0
                  ? item.photoUrls
                  : item.photoUrl
                  ? [item.photoUrl]
                  : []
              }
              title={item.displayName}
            />
          </div>

          {/* Metadata Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-neutral-dark uppercase tracking-wider text-[11px]">
              Item Details & Specifications
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Custom Name</span>
                <p className="font-semibold text-neutral-dark text-sm">
                  {item.customName || '— (Uses catalog title)'}
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Brand</span>
                <p className="font-semibold text-neutral-dark text-sm">{item.brand || '—'}</p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Category</span>
                <p className="font-semibold text-neutral-dark text-sm">{item.category || '—'}</p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Quantity</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {item.quantity}{' '}
                  <span className="font-normal text-xs text-neutral-mid">{item.unit}</span>
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Price</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {item.price !== null ? `$${item.price.toFixed(2)}` : '—'}
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Store</span>
                <p className="font-semibold text-neutral-dark text-sm">{item.store || '—'}</p>
              </div>
            </div>

            {/* Notes */}
            {item.notes && (
              <div className="space-y-1 pt-2">
                <span className="text-[11px] font-semibold text-neutral-mid uppercase tracking-wide">
                  Item Notes
                </span>
                <div className="rounded-xl bg-neutral-50 p-3.5 text-xs text-neutral-dark border border-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {item.notes}
                </div>
              </div>
            )}
          </div>

          {/* Lifecycle & Dates Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-neutral-dark uppercase tracking-wider text-[11px]">
              Dates & Lifecycle Timeline
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Expiry Date</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {item.expiryDate}
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Purchase Date</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {item.purchaseDate || '—'}
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Created (First Added)</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                <span className="text-neutral-mid font-medium">Last Modified</span>
                <p className="font-semibold text-neutral-dark text-sm font-mono">
                  {new Date(item.updatedAt).toLocaleString()}
                </p>
              </div>

              {item.consumedAt && (
                <div className="space-y-1 p-3 rounded-xl bg-neutral-50/60 border border-neutral-100">
                  <span className="text-neutral-mid font-medium">Consumed Date</span>
                  <p className="font-semibold text-neutral-dark text-sm font-mono">
                    {new Date(item.consumedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {item.discardedAt && (
                <div className="space-y-1 p-3 rounded-xl bg-red-50/50 border border-red-100 sm:col-span-2">
                  <span className="text-red-700 font-medium">Discarded Date & Reason</span>
                  <p className="font-semibold text-red-900 text-sm font-mono">
                    {new Date(item.discardedAt).toLocaleString()}
                    {item.discardReason && ` — Reason: "${item.discardReason}"`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Scheduled Reminders */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-dark uppercase tracking-wider text-[11px]">
                Notification Schedule
              </h2>
              <span className="text-xs text-neutral-mid">
                {item.notifyAt.length} reminder(s) configured
              </span>
            </div>

            {item.notifyAt.length === 0 ? (
              <p className="text-xs text-neutral-mid italic">
                No future notification reminders scheduled.
              </p>
            ) : (
              <div className="space-y-1.5">
                {item.notifyAt.map((ts, idx) => (
                  <div
                    key={ts + idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-mono text-neutral-dark"
                  >
                    <Bell size={13} className="text-primary shrink-0" />
                    <span>Reminder {idx + 1}:</span>
                    <strong className="font-semibold">{new Date(ts).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          {/* Owner Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
            <h3 className="text-xs font-semibold text-neutral-mid uppercase tracking-wider">
              Item Owner
            </h3>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light/60 text-xs font-bold text-primary-dark shadow-xs">
                {userInitials}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/users/${item.user.id}`}
                  className="font-semibold text-sm text-neutral-dark hover:text-primary transition truncate block"
                >
                  {item.user.email}
                </Link>
                <p className="text-xs text-neutral-mid truncate">
                  {`${item.user.firstName ?? ''} ${item.user.lastName ?? ''}`.trim() || '—'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
              <span className="text-neutral-mid">Country:</span>
              <span className="font-mono font-medium text-neutral-dark">
                {item.user.country || '—'}
              </span>
            </div>

            <Link
              href={`/users/${item.user.id}`}
              className="w-full inline-flex items-center justify-center h-8 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-dark hover:border-primary hover:text-primary transition"
            >
              View User Profile
            </Link>
          </div>

          {/* Catalog Product Card */}
          {item.product && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
              <h3 className="text-xs font-semibold text-neutral-mid uppercase tracking-wider">
                Catalog Product Reference
              </h3>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-500 overflow-hidden">
                  {item.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/products/${item.product.id}`}
                    className="font-semibold text-sm text-neutral-dark hover:text-primary transition truncate block"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-neutral-mid truncate">
                    {item.product.brand || 'No brand'} · {item.product.category || 'No category'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-xs">
                {item.product.barcode && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-mid">Barcode:</span>
                    <span className="font-mono text-[11px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                      {item.product.barcode}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-mid">Catalog Version:</span>
                  <span className="font-mono text-neutral-dark">v{item.product.version ?? 1}</span>
                </div>
              </div>

              <Link
                href={`/products/${item.product.id}`}
                className="w-full inline-flex items-center justify-center h-8 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-dark hover:border-primary hover:text-primary transition"
              >
                View Catalog Product
              </Link>
            </div>
          )}

          {/* Household Card */}
          {item.household && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
              <h3 className="text-xs font-semibold text-neutral-mid uppercase tracking-wider">
                Shared Household Scope
              </h3>

              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                  <Home size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-neutral-dark">
                    {item.household.name}
                  </h4>
                  <p className="text-xs text-neutral-mid">
                    {item.household.memberCount ?? 1} members sharing
                  </p>
                </div>
              </div>

              <Link
                href={`/households/${item.household.id}`}
                className="w-full inline-flex items-center justify-center h-8 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-dark hover:border-primary hover:text-primary transition mt-2"
              >
                View Household
              </Link>
            </div>
          )}

          {/* Activity / Relations Counts */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-2.5 text-xs">
            <h3 className="text-xs font-semibold text-neutral-mid uppercase tracking-wider">
              Activity & External Links
            </h3>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-mid">Push Logs:</span>
              <strong className="font-semibold text-neutral-dark">{item.pushLogsCount}</strong>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-mid">Giveaway Claims:</span>
              <strong className="font-semibold text-neutral-dark">{item.giveawaysCount}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
