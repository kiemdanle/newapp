import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { ProductActions } from './product-actions';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await serverAdminApi.products.get(id);

  return (
    <div className="space-y-6">
      <Link href="/products" className="text-sm text-neutral-mid hover:underline">
        ← Products
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="h-16 w-16 rounded-md border object-cover" />
          )}
          <div>
            <h1 className="text-[28px] font-semibold text-neutral-dark font-display">{p.name}</h1>
            <p className="text-sm text-neutral-mid">{p.brand ?? '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-mid">
              <StatusBadge status={p.status} />
              <span>source: {p.source}</span>
              {p.barcode && <span>barcode: {p.barcode}</span>}
              {p.category && <span>{p.category}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Reviews" value={p.reviewCount} />
        <KpiCard label="Ratings" value={p.ratingCount} />
        <KpiCard label="Buy again" value={p.buyAgainCount} />
        <KpiCard label="Buy on sale" value={p.buyAgainOnSaleCount} />
        <KpiCard label="Won't buy" value={p.wontBuyCount} />
        <KpiCard label="Community" value={p.isCommunityEligible ? 'Yes' : 'No'} />
      </div>

      <ProductActions id={p.id} name={p.name} brand={p.brand} category={p.category} />
    </div>
  );
}
