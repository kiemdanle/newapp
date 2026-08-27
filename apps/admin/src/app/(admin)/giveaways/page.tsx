import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { GiveawayActions } from './giveaway-actions';
import { Gift, MapPin, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface GiveawayRow {
  id: string;
  title: string;
  giverName: string;
  locationText: string;
  status: string;
  claimCount: number;
  selectedClaimId: string | null;
  createdAt: string;
}

export default async function GiveawaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { status: sp.status, cursor: sp.cursor };
  const data = (await serverAdminApi.giveaways.list(query)) as { items: GiveawayRow[]; nextCursor: string | null };
  const { items, nextCursor } = data;

  const columns: Column<GiveawayRow>[] = [
    {
      header: 'Giveaway Item',
      cell: (r) => <span className="font-semibold text-neutral-dark line-clamp-1">{r.title}</span>,
    },
    {
      header: 'Giver',
      cell: (r) => <span className="text-xs font-medium text-neutral-dark">{r.giverName}</span>,
    },
    {
      header: 'Pickup Area',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs text-neutral-mid truncate max-w-[200px]">
          <MapPin size={12} className="text-neutral-mid/70 shrink-0" />
          <span>{r.locationText || 'No location set'}</span>
        </span>
      ),
    },
    {
      header: 'Claims Activity',
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-dark">
          <Users size={12} className="text-primary" />
          <span>{r.claimCount} claims</span>
          {r.selectedClaimId && (
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.2 text-[10px]">
              Recipient matched
            </span>
          )}
        </div>
      ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Posted',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    { header: 'Actions', cell: (r) => <GiveawayActions id={r.id} status={r.status} /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Gift size={14} />
          <span>Surplus Sharing</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Pantry Giveaways
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Monitor community food surplus giveaways, claim hand-offs, and completion states.
        </p>
      </div>

      <FilterBar action="/giveaways">
        <SelectFilter
          name="status"
          label="Giveaway Status"
          value={sp.status}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'claimed', label: 'Claimed' },
            { value: 'handed_off', label: 'Handed off' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No giveaways match these filters." />
      <LoadMore basePath="/giveaways" params={query} nextCursor={nextCursor} />
    </div>
  );
}
