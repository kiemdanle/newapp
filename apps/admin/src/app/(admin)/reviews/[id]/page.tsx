import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { ReviewActions } from './review-actions';

export const dynamic = 'force-dynamic';

const RATING_LABEL: Record<string, string> = {
  buy_again: 'Buy again',
  buy_again_on_sale: 'Buy again on sale',
  wont_buy: "Won't buy",
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await serverAdminApi.reviews.get(id);

  return (
    <div className="space-y-6">
      <Link href="/reviews" className="text-sm text-muted-foreground hover:underline">
        ← Reviews
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{RATING_LABEL[r.rating] ?? r.rating}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={r.status} />
            <span className="text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <ReviewActions id={r.id} status={r.status} />
      </div>

      <div className="rounded-lg border p-4">
        <p className="whitespace-pre-wrap text-sm">{r.comment ?? '— no comment —'}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Helpful</dt>
          <dd>{r.helpfulCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Not helpful</dt>
          <dd>{r.notHelpfulCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Product</dt>
          <dd>
            <Link href={`/products/${r.productId}`} className="hover:underline">
              {r.productId.slice(0, 8)}…
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Author</dt>
          <dd>
            <Link href={`/users/${r.userId}`} className="hover:underline">
              {r.userId.slice(0, 8)}…
            </Link>
          </dd>
        </div>
      </dl>
    </div>
  );
}
