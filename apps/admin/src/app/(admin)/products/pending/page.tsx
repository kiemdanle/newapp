import Link from 'next/link';
import { adminProductStatusSchema } from '@expyrico/shared';
import { z } from 'zod';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ModerationFilters } from './moderation-filters';
import { Clock, GitPullRequest, Sparkles, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const queueSearchParamsSchema = z.object({
  type: z.enum(['new', 'revision']).optional(),
  status: adminProductStatusSchema.optional(),
  age: z.enum(['24h', '72h', '7d']).optional(),
});

export const dynamic = 'force-dynamic';

type NewRow = Awaited<ReturnType<typeof serverAdminApi.products.list>>['items'][number];
type RevisionRow = Awaited<ReturnType<typeof serverAdminApi.products.pending>>['items'][number];
type QueueRow = { kind: 'new'; createdAt: string; data: NewRow } | { kind: 'revision'; createdAt: string; data: RevisionRow };

const AGE_THRESHOLDS_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return '<1h ago';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function ProductsPendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const rawSp = await searchParams;
  const parsedSp = queueSearchParamsSchema.safeParse(rawSp);
  const { type, status: validatedStatus, age } = parsedSp.success ? parsedSp.data : {};
  const status = validatedStatus ?? 'pending';

  const [newProducts, revisions] = await Promise.all([
    type === 'revision'
      ? Promise.resolve({ items: [] as NewRow[], nextCursor: null as string | null })
      : serverAdminApi.products.list({ status, cursor: rawSp.cursorNew }),
    type === 'new'
      ? Promise.resolve({ items: [] as RevisionRow[], nextCursor: null as string | null })
      : serverAdminApi.products.pending({ cursor: rawSp.cursorRevision }),
  ]);

  let rows: QueueRow[] = [
    ...newProducts.items.map((data): QueueRow => ({ kind: 'new', createdAt: data.createdAt, data })),
    ...revisions.items.map((data): QueueRow => ({ kind: 'revision', createdAt: data.createdAt, data })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (age && AGE_THRESHOLDS_MS[age]) {
    const cutoff = Date.now() - AGE_THRESHOLDS_MS[age]!;
    rows = rows.filter((r) => new Date(r.createdAt).getTime() <= cutoff);
  }

  const columns: Column<QueueRow>[] = [
    {
      header: 'Queue Type',
      cell: (r) =>
        r.kind === 'new' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold">
            <Sparkles size={12} className="text-emerald-600" />
            <span>New product</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold">
            <GitPullRequest size={12} className="text-amber-600" />
            <span>Revision</span>
          </span>
        ),
    },
    {
      header: 'Product Item',
      cell: (r) => (
        <div className="min-w-0">
          {r.kind === 'new' ? (
            <Link
              href={`/products/${r.data.id}`}
              className="font-semibold text-neutral-dark hover:text-primary transition-colors line-clamp-1"
            >
              {r.data.name}
            </Link>
          ) : (
            <Link
              href={`/products/pending/${r.data.id}`}
              className="font-semibold text-neutral-dark hover:text-primary transition-colors line-clamp-1"
            >
              {r.data.name || r.data.productName || 'Untitled product'}
            </Link>
          )}
          {r.kind === 'revision' && r.data.productName && r.data.name !== r.data.productName && (
            <p className="text-xs text-neutral-mid truncate mt-0.5">
              Target: <span className="font-medium text-neutral-dark/70">{r.data.productName}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Submitted By',
      cell: (r) => {
        const creator = r.data.creator;
        if (!creator) return <span className="text-xs text-neutral-mid">—</span>;
        const fullName = `${creator.firstName} ${creator.lastName}`.trim();
        return (
          <div className="text-xs min-w-0">
            <span className="font-semibold text-neutral-dark">{fullName || creator.email}</span>
            {creator.email && fullName && fullName !== creator.email && (
              <span className="text-neutral-mid block text-[11px] truncate max-w-[160px]">
                {creator.email}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Photos',
      cell: (r) =>
        r.kind === 'new' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-dark">
            <ImageIcon size={13} className="text-neutral-mid" />
            <span>{r.data.photos?.length ?? 0}</span>
          </span>
        ) : (
          <span className="text-xs text-neutral-mid">—</span>
        ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.data.status} /> },
    {
      header: 'Submitted',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono whitespace-nowrap">
          {relativeAge(r.createdAt)}
        </span>
      ),
    },
  ];

  const nextCursorNew = newProducts.nextCursor;
  const nextCursorRevision = revisions.nextCursor;
  const hasMore = Boolean(nextCursorNew || nextCursorRevision);
  const moreParams = new URLSearchParams();
  if (type) moreParams.set('type', type);
  if (validatedStatus) moreParams.set('status', validatedStatus);
  if (age) moreParams.set('age', age);
  if (nextCursorNew) moreParams.set('cursorNew', nextCursorNew);
  if (nextCursorRevision) moreParams.set('cursorRevision', nextCursorRevision);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Clock size={14} />
          <span>Moderation Queue</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Pending Approval Queue
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Review newly submitted catalog products and user-proposed revisions before publishing to the live catalog.
        </p>
      </div>

      <ModerationFilters type={type} status={validatedStatus} age={age} />

      {age && (
        <div className="rounded-xl border border-border bg-neutral-light/40 px-4 py-2.5 text-xs text-neutral-mid">
          Age filter applies to the current batch — load additional pages to inspect older submissions.
        </div>
      )}

      <DataTable data={rows} columns={columns} empty="No moderation submissions match these filters." />

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            asChild
            variant="outline"
            className="h-10 px-5 rounded-xl border-neutral-300 bg-white text-sm font-semibold text-neutral-dark shadow-xs hover:border-primary hover:text-primary gap-2"
          >
            <Link href={`/products/pending?${moreParams.toString()}`}>
              <span>Load next batch</span>
              <ChevronDown size={16} />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
