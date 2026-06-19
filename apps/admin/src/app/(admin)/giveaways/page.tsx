import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter } from '@/components/filter-bar';
import { GiveawayActions } from './giveaway-actions';

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
    { header: 'Title', cell: (r) => <span className="font-medium">{r.title}</span> },
    { header: 'Giver', cell: (r) => r.giverName },
    { header: 'Location', cell: (r) => r.locationText },
    {
      header: 'Claims',
      cell: (r) => `${r.claimCount}${r.selectedClaimId ? ' (selected)' : ''}`,
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Created', cell: (r) => new Date(r.createdAt).toLocaleDateString() },
    { header: 'Actions', cell: (r) => <GiveawayActions id={r.id} status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Giveaways</h1>
      <FilterBar action="/giveaways">
        <SelectFilter
          name="status"
          label="Status"
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
