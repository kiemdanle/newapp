import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { Home, Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.households.list>>['items'][number];

export default async function HouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const sp = await searchParams;
  const { items, nextCursor } = await serverAdminApi.households.list({
    cursor: sp.cursor,
  });

  const columns: Column<Row>[] = [
    {
      header: 'Household Group',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light/50 text-primary-dark shadow-2xs">
            <Home size={16} />
          </div>
          <Link
            href={`/households/${r.id}`}
            className="font-semibold text-neutral-dark hover:text-primary transition-colors truncate max-w-sm block"
          >
            {r.name}
          </Link>
        </div>
      ),
    },
    {
      header: 'Members',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-light px-2.5 py-0.5 text-xs font-semibold text-neutral-dark">
          <Users size={12} className="text-neutral-mid" />
          <span>{r.memberCount} members</span>
        </span>
      ),
    },
    {
      header: 'Household Owner',
      cell: (r) => (
        <div className="text-xs">
          <span className="font-semibold text-neutral-dark">{r.ownerFirstName}</span>
          <span className="text-neutral-mid block text-[11px]">{r.ownerEmail}</span>
        </div>
      ),
    },
    {
      header: 'Created',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Home size={14} />
          <span>Shared Spaces</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Pantry Households
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Shared pantry management groups and household memberships.
        </p>
      </div>

      <DataTable data={items} columns={columns} empty="No households created yet." />

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Button
            asChild
            variant="outline"
            className="h-10 px-5 rounded-xl border-neutral-300 bg-white text-sm font-semibold text-neutral-dark shadow-xs hover:border-primary hover:text-primary gap-2"
          >
            <Link href={`/households?cursor=${encodeURIComponent(nextCursor)}`}>
              <span>Load more households</span>
              <ChevronDown size={16} />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
