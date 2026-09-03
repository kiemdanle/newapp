import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';
import { Users, User as UserIcon, Shield, ShieldAlert } from 'lucide-react';

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
      header: 'Account User',
      cell: (u) => {
        const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light/60 text-xs font-bold text-primary-dark shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <Link
                href={`/users/${u.id}`}
                className="font-semibold text-neutral-dark hover:text-primary transition-colors truncate block"
              >
                {u.email}
              </Link>
              <p className="text-xs text-neutral-mid truncate">
                {`${u.firstName} ${u.lastName}`.trim() || '—'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Country',
      cell: (u) => (
        <span className="font-mono text-xs font-medium text-neutral-dark">
          {u.country ? (
            <span className="rounded-md bg-neutral-light px-2 py-0.5">{u.country}</span>
          ) : (
            '—'
          )}
        </span>
      ),
    },
    {
      header: 'Role',
      cell: (u) =>
        u.role === 'admin' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-light/50 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
            <Shield size={11} className="text-primary" />
            <span>Admin</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-light border border-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-dark">
            <UserIcon size={11} className="text-neutral-mid" />
            <span>User</span>
          </span>
        ),
    },
    { header: 'Status', cell: (u) => <StatusBadge status={u.status} /> },
    {
      header: 'Product Approval',
      cell: (u) =>
        u.requireProductApproval ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <ShieldAlert size={10} className="text-amber-600" />
            <span>Required</span>
          </span>
        ) : (
          <span className="text-[11px] text-neutral-mid font-medium">
            Auto
          </span>
        ),
    },
    {
      header: 'Last Active',
      cell: (u) => (
        <span className="text-xs text-neutral-mid font-mono">
          {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Users size={14} />
          <span>People & Permissions</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          User Directory
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Manage user accounts, administrative privileges, and security status.
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar action="/users">
        <TextFilter name="q" label="Search User" value={sp.q} placeholder="Email, name, or keywords…" />
        <SelectFilter
          name="status"
          label="Account Status"
          value={sp.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        <SelectFilter
          name="role"
          label="Account Role"
          value={sp.role}
          options={[
            { value: 'user', label: 'User' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      </FilterBar>

      <DataTable data={items} columns={columns} empty="No users found matching your search." />
      <LoadMore basePath="/users" params={query} nextCursor={nextCursor} />
    </div>
  );
}
