import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { MergeTool } from './merge-tool';
import { ArrowLeft, Merge } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MergePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;

  const winner = await serverAdminApi.products.get(id);
  const candidates = q ? (await serverAdminApi.products.list({ q })).items : [];

  return (
    <div className="space-y-8">
      <Link
        href={`/products/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to {winner.name}</span>
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Merge size={14} />
          <span>Product Consolidation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display tracking-tight">
          Merge Duplicate Products into {winner.name}
        </h1>
        <p className="text-xs text-neutral-mid leading-relaxed max-w-2xl">
          Consolidate barcode scans, reviews, and pantry records from duplicate items into this canonical target product.
        </p>
      </div>

      <MergeTool winnerId={id} winnerVersion={winner.version} candidates={candidates} query={q ?? ''} />
    </div>
  );
}
