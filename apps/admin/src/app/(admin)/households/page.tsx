import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.households.list>>['items'][number];

export default async function HouseholdsPage({
  searchParams,
}: {
  searchParams: { cursor?: string };
}) {
  const { items, nextCursor } = await serverAdminApi.households.list({
    cursor: searchParams.cursor,
  });

  const columns: Column<Row>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <Link href={`/households/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    { header: 'Members', cell: (r) => r.memberCount, className: 'w-24' },
    {
      header: 'Owner',
      cell: (r) => (
        <span>
          {r.ownerFirstName}{' '}
          <span className="text-neutral-mid">{r.ownerEmail}</span>
        </span>
      ),
    },
    {
      header: 'Created',
      cell: (r) => new Date(r.createdAt).toLocaleDateString(),
      className: 'w-28',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Households</h1>

      <DataTable data={items} columns={columns} empty="No households yet." />

      {nextCursor && (
        <Link
          href={`/households?cursor=${encodeURIComponent(nextCursor)}`}
          className="text-sm text-primary hover:underline"
        >
          Load more
        </Link>
      )}
    </div>
  );
}
