import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { UserActions } from './user-actions';
import { ArrowLeft, User as UserIcon, Shield, Package, MessageSquare, Flag, Key, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Session = Awaited<ReturnType<typeof serverAdminApi.users.get>>['sessions'][number];

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await serverAdminApi.users.get(id);
  const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  const sessionColumns: Column<Session>[] = [
    {
      header: 'IP Address',
      cell: (s) => (
        <span className="font-mono text-xs font-medium text-neutral-dark">
          {s.ip ?? '—'}
        </span>
      ),
    },
    {
      header: 'Device & Platform',
      cell: (s) => {
        const d = s.deviceInfo as { name?: string; os?: string } | null;
        return (
          <span className="text-xs font-medium text-neutral-dark">
            {d?.name ?? d?.os ?? 'Standard Web Session'}
          </span>
        );
      },
    },
    {
      header: 'Expires At',
      cell: (s) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(s.expiresAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'State',
      cell: (s) => <StatusBadge status={s.revokedAt ? 'deleted' : 'active'} />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to user directory</span>
      </Link>

      {/* Hero Header Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light/60 text-lg font-bold text-primary-dark shadow-xs border border-primary/20">
            {initials}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={u.status} />
              {u.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-light/50 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
                  <Shield size={11} className="text-primary" />
                  <span>Admin</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-light border border-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-dark">
                  <UserIcon size={11} className="text-neutral-mid" />
                  <span>User</span>
                </span>
              )}
              {u.country && (
                <span className="rounded-md bg-neutral-light px-2 py-0.5 text-xs font-mono font-medium text-neutral-dark">
                  Country: {u.country}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display tracking-tight">
              {`${u.firstName} ${u.lastName}`.trim() || u.email}
            </h1>
            <p className="text-xs text-neutral-mid font-mono">{u.email}</p>
          </div>
        </div>

        {/* User Actions */}
        <UserActions id={u.id} status={u.status} role={u.role} totpEnabledAt={u.totpEnabledAt} />
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Pantry Records" value={u.recordCount} icon={Package} />
        <KpiCard label="Reviews Written" value={u.reviewCount} icon={MessageSquare} />
        <KpiCard label="Open Reports" value={u.openReportsAgainst} icon={Flag} />
        <KpiCard
          label="Email Verified"
          value={u.emailVerifiedAt ? 'Verified' : 'Unverified'}
          icon={CheckCircle}
          sub={u.emailVerifiedAt ? new Date(u.emailVerifiedAt).toLocaleDateString() : undefined}
        />
        <KpiCard label="Two-Factor (2FA)" value={u.totpEnabledAt ? 'Enabled' : 'Disabled'} icon={Key} />
      </div>

      {/* Active Sessions */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-dark font-display">
            Active Sessions ({u.sessions.length})
          </h2>
          <p className="text-xs text-neutral-mid">
            Connected devices and authentication tokens for this account.
          </p>
        </div>
        <DataTable data={u.sessions} columns={sessionColumns} empty="No active sessions found for this user." />
      </div>
    </div>
  );
}
