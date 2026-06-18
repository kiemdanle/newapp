import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { MergeTool } from './merge-tool';

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

  // Only fetch candidates once the operator has searched — an unfiltered list of
  // every product is rarely the intended merge set.
  const winner = await serverAdminApi.products.get(id);
  const candidates = q ? (await serverAdminApi.products.list({ q })).items : [];

  return (
    <div className="space-y-4">
      <Link href={`/products/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← {winner.name}
      </Link>
      <h1 className="text-xl font-semibold">Merge into {winner.name}</h1>
      <MergeTool winnerId={id} candidates={candidates} query={q ?? ''} />
    </div>
  );
}
