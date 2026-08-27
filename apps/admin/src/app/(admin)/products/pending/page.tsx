import Link from 'next/link';
import { adminProductStatusSchema } from '@expyrico/shared';
import { z } from 'zod';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ModerationFilters } from './moderation-filters';

// `sp.status` used to go straight into the upstream query string unvalidated —
// an arbitrary `?status=bogus` produced an unhandled upstream 400 that
// propagated out of this Server Component as a generic error page.
// `safeParse` + a default keeps a malformed value from ever reaching the API.
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

/**
 * Unified moderation queue: brand-new creator submissions (`Product.status ===
 * 'pending'`) and active-product revisions (`ProductEdit.status === 'pending'`)
 * are two independent, independently-paginated upstream sources — merged and
 * sorted client-side (server-rendered, not a browser fetch) into one queue so an
 * admin doesn't have to work two separate screens. Two requests total, never
 * N+1: each source is fetched once per page load regardless of row count.
 */
export default async function ProductsPendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const rawSp = await searchParams;
  const parsedSp = queueSearchParamsSchema.safeParse(rawSp);
  // An invalid value (e.g. a hand-edited `?status=bogus`) falls back to the
  // unfiltered defaults rather than reaching the upstream API at all.
  const { type, status: validatedStatus, age } = parsedSp.success ? parsedSp.data : {};
  // The API query always needs a concrete status; the filter UI and
  // pagination links use `validatedStatus` (still `undefined` when nothing
  // valid was selected) so they never display/propagate a value the query
  // didn't actually use.
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
      header: 'Type',
      cell: (r) => (
        <span className="text-xs font-medium text-neutral-mid">{r.kind === 'new' ? 'New product' : 'Revision'}</span>
      ),
    },
    {
      header: 'Item',
      cell: (r) =>
        r.kind === 'new' ? (
          <Link href={`/products/${r.data.id}`} className="font-medium hover:underline">
            {r.data.name}
          </Link>
        ) : (
          <Link href={`/products/pending/${r.data.id}`} className="font-medium hover:underline">
            {r.data.name || r.data.productName || 'Untitled product'}
          </Link>
        ),
    },
    {
      header: 'Creator',
      cell: (r) => {
        const creator = r.data.creator;
        if (!creator) return <span className="text-xs text-neutral-mid">—</span>;
        const fullName = `${creator.firstName} ${creator.lastName}`.trim();
        return (
          <span className="text-xs">
            {fullName ? <span className="font-medium text-neutral-dark">{fullName} </span> : null}
            <span className="text-neutral-mid">{creator.email}</span>
          </span>
        );
      },
    },
    {
      header: 'Photos',
      // Only cheaply available for the new-product source (already included in its
      // list row); a revision's photo count would require an extra per-row fetch
      // (N+1), so it's shown on the revision detail page instead, where it's a
      // single fetch either way.
      cell: (r) => (r.kind === 'new' ? (r.data.photos?.length ?? 0) : '—'),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.kind === 'new' ? r.data.status : r.data.status} /> },
    { header: 'Age', cell: (r) => relativeAge(r.createdAt) },
  ];

  // The age filter is applied to each already-fetched page, not pushed to the
  // API — so pagination stays live (never hard-disabled) rather than silently
  // truncating a backlog larger than one page to "no more results". The UI
  // discloses that the filter is page-scoped instead.
  const nextCursorNew = newProducts.nextCursor;
  const nextCursorRevision = revisions.nextCursor;
  const hasMore = Boolean(nextCursorNew || nextCursorRevision);
  const moreParams = new URLSearchParams();
  if (type) moreParams.set('type', type);
  // The *validated* status, not the raw query value or the query's own
  // defaulted `status` — an invalid `status` must not survive into "Load
  // more" links or the filter control's displayed state, and "no filter
  // selected" (validatedStatus undefined) must not be shown as "Pending"
  // just because the query defaults to it.
  if (validatedStatus) moreParams.set('status', validatedStatus);
  if (age) moreParams.set('age', age);
  if (nextCursorNew) moreParams.set('cursorNew', nextCursorNew);
  if (nextCursorRevision) moreParams.set('cursorRevision', nextCursorRevision);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Moderation queue</h1>
      <ModerationFilters type={type} status={validatedStatus} age={age} />
      {age && (
        <p className="text-xs text-neutral-mid">
          Age filter applies to this page only — load more pages to see older matches beyond it.
        </p>
      )}
      <DataTable data={rows} columns={columns} empty="No items match these filters." />
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Link href={`/products/pending?${moreParams.toString()}`} className="text-sm text-neutral-mid hover:text-primary">
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
