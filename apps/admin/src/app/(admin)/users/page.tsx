import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.users.list>>['items'][number];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = {
    q: sp.q,
    status: sp.status,
    role: sp.role,
    cursor: sp.cursor,
  };
  const { items, nextCursor } = await serverAdminApi.users.list(query);

  const columns: Column<Row>[] = [
    {
      header: 'Email',
      cell: (u) => (
        <Link href={`/users/${u.id}`} className="font-medium hover:underline">
          {u.email}
        </Link>
      ),
    },
    { header: 'Name', cell: (u) => `${u.firstName} ${u.lastName}`.trim() || '—' },
    { header: 'Country', cell: (u) => u.country ?? '—' },
    { header: 'Role', cell: (u) => u.role },
    { header: 'Status', cell: (u) => <StatusBadge status={u.status} /> },
    {
      header: 'Last seen',
      cell: (u) => (u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <FilterBar action="/users">
        <TextFilter name="q" label="Search" value={sp.q} placeholder="email or name" />
        <SelectFilter
          name="status"
          label="Status"
          value={sp.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        <SelectFilter
          name="role"
          label="Role"
          value={sp.role}
          options={[
            { value: 'user', label: 'User' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      </FilterBar>
      <DataTable data={items} columns={columns} empty="No users match these filters." />
      <LoadMore basePath="/users" params={query} nextCursor={nextCursor} />
    </div>
  );
}
