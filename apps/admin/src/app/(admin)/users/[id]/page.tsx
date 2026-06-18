import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { UserActions } from './user-actions';

export const dynamic = 'force-dynamic';

type Session = Awaited<ReturnType<typeof serverAdminApi.users.get>>['sessions'][number];

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await serverAdminApi.users.get(id);

  const sessionColumns: Column<Session>[] = [
    { header: 'IP', cell: (s) => s.ip ?? '—' },
    {
      header: 'Device',
      cell: (s) => {
        const d = s.deviceInfo as { name?: string; os?: string } | null;
        return d?.name ?? d?.os ?? '—';
      },
    },
    { header: 'Expires', cell: (s) => new Date(s.expiresAt).toLocaleString() },
    {
      header: 'State',
      cell: (s) => <StatusBadge status={s.revokedAt ? 'deleted' : 'active'} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/users" className="text-sm text-muted-foreground hover:underline">
          ← Users
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {`${u.firstName} ${u.lastName}`.trim() || u.email}
          </h1>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={u.status} />
            <span className="text-xs text-muted-foreground">{u.role}</span>
            {u.country && <span className="text-xs text-muted-foreground">{u.country}</span>}
          </div>
        </div>
        <UserActions id={u.id} status={u.status} role={u.role} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Records" value={u.recordCount} />
        <KpiCard label="Reviews" value={u.reviewCount} />
        <KpiCard label="Reports against" value={u.openReportsAgainst} />
        <KpiCard
          label="Email verified"
          value={u.emailVerifiedAt ? 'Yes' : 'No'}
          sub={u.emailVerifiedAt ? new Date(u.emailVerifiedAt).toLocaleDateString() : undefined}
        />
        <KpiCard label="2FA" value={u.totpEnabledAt ? 'On' : 'Off'} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Sessions</h2>
        <DataTable data={u.sessions} columns={sessionColumns} empty="No sessions." />
      </div>
    </div>
  );
}
