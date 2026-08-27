import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { ProductActions } from './product-actions';
import { ProductPhotoManager } from './product-photo-manager';
import { ArrowLeft, Package, Merge, ExternalLink, Star, ThumbsUp, Tag, ThumbsDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await serverAdminApi.products.get(id);
  const isMerged = p.status === 'merged_into';

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to products catalog</span>
      </Link>

      {/* Hero Product Header Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-20 w-20 shrink-0 rounded-2xl border border-neutral-200 object-cover bg-white shadow-xs"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-neutral-light text-neutral-mid/70 border border-neutral-200 shadow-xs">
              <Package size={32} />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              <span className="inline-flex items-center rounded-md bg-neutral-light px-2 py-0.5 text-xs font-medium text-neutral-dark uppercase">
                Source: {p.source}
              </span>
              {p.barcode && (
                <span className="rounded-md bg-neutral-light px-2 py-0.5 text-xs font-mono font-medium text-neutral-dark">
                  Barcode: {p.barcode}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display tracking-tight">
              {p.name}
            </h1>
            <p className="text-sm text-neutral-mid font-medium">
              {p.brand ? <span>{p.brand}</span> : <span className="text-neutral-mid/60">No brand specified</span>}
              {p.category && <span> · {p.category}</span>}
              {p.creator && (
                <span>
                  {' '}
                  · Added by{' '}
                  <span className="font-semibold text-neutral-dark">
                    {`${p.creator.firstName} ${p.creator.lastName}`.trim() || p.creator.email}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Header Action Shortcuts */}
        {!isMerged && (
          <div className="flex items-center gap-3 shrink-0">
            <Button asChild variant="outline" className="rounded-xl shadow-xs gap-1.5">
              <Link href={`/products/${p.id}/merge`}>
                <Merge size={16} />
                <span>Merge product</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Merged Banner */}
      {isMerged && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900 shadow-xs space-y-1">
          <p className="font-semibold">This product was merged into another catalog item.</p>
          {p.mergedIntoProductId && (
            <p className="text-xs">
              <Link
                href={`/products/${p.mergedIntoProductId}`}
                className="inline-flex items-center gap-1 font-semibold text-primary underline"
              >
                <span>View destination canonical product</span>
                <ExternalLink size={12} />
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Metric Indicators */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Reviews" value={p.reviewCount} icon={Star} />
        <KpiCard label="Ratings" value={p.ratingCount} icon={ThumbsUp} />
        <KpiCard label="Buy Again" value={p.buyAgainCount} icon={ThumbsUp} />
        <KpiCard label="Buy on Sale" value={p.buyAgainOnSaleCount} icon={Tag} />
        <KpiCard label="Won't Buy" value={p.wontBuyCount} icon={ThumbsDown} />
        <KpiCard label="Community" value={p.isCommunityEligible ? 'Eligible' : 'Standard'} icon={Users} />
      </div>

      {/* Detail Panels */}
      {!isMerged && (
        <div className="space-y-8">
          <ProductPhotoManager productId={p.id} photos={p.photos ?? []} />

          <ProductActions
            id={p.id}
            version={p.version}
            name={p.name}
            brand={p.brand}
            category={p.category}
            status={p.status}
            priorFeedback={p.moderationNotes ?? null}
          />
        </div>
      )}
    </div>
  );
}
