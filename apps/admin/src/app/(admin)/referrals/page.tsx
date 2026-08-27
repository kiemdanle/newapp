import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { Share2, Users, CheckCircle, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<
  ReturnType<typeof serverAdminApi.referrals.overview>
>['topReferrers'][number];

export default async function ReferralsPage() {
  const overview = await serverAdminApi.referrals.overview();

  const columns: Column<Row>[] = [
    {
      header: 'Referrer Account',
      cell: (r) => (
        <div className="text-xs">
          <span className="font-semibold text-neutral-dark">{r.firstName || 'User'}</span>
          <span className="text-neutral-mid block text-[11px] font-mono">{r.email}</span>
        </div>
      ),
    },
    {
      header: 'Referral Code',
      cell: (r) => (
        <span className="inline-flex items-center rounded-md bg-neutral-light border border-neutral-200 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-dark">
          {r.referralCode ?? '—'}
        </span>
      ),
    },
    {
      header: 'Invited Users',
      cell: (r) => (
        <span className="font-semibold text-neutral-dark text-xs">
          {r.referredCount} <span className="font-normal text-neutral-mid">invited</span>
        </span>
      ),
    },
    {
      header: 'Activated Users',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full text-xs font-semibold">
          <CheckCircle size={11} className="text-emerald-600" />
          <span>{r.activatedCount} active</span>
        </span>
      ),
    },
    {
      header: 'Abuse Flag',
      cell: (r) =>
        r.abuseFlag ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200/80">
            <AlertTriangle size={11} className="text-red-600" />
            <span>Review flagged</span>
          </span>
        ) : (
          <span className="text-xs text-neutral-mid">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Share2 size={14} />
          <span>Growth & Attribution</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Referral Programs
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Track referral invitations, activation rates, and monitor potential referral abuse flags.
        </p>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Referrals"
          value={overview.totalReferrals.toLocaleString()}
          icon={Users}
          sub="Total invited friends"
        />
        <KpiCard
          label="Activated Accounts"
          value={overview.totalActivated.toLocaleString()}
          icon={CheckCircle}
          trend={`${Math.round((overview.totalActivated / Math.max(overview.totalReferrals, 1)) * 100)}% conversion`}
          trendUp={true}
        />
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-neutral-dark font-display">
          Top Referrers
        </h2>
        <DataTable
          data={overview.topReferrers}
          columns={columns}
          empty="No referral invitations recorded yet."
        />
      </div>
    </div>
  );
}
