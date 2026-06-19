import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';

export const dynamic = 'force-dynamic';

type Row = Awaited<
  ReturnType<typeof serverAdminApi.referrals.overview>
>['topReferrers'][number];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function ReferralsPage() {
  const overview = await serverAdminApi.referrals.overview();

  const columns: Column<Row>[] = [
    {
      header: 'User',
      cell: (r) => (
        <span>
          {r.firstName}{' '}
          <span className="text-muted-foreground">{r.email}</span>
        </span>
      ),
    },
    {
      header: 'Code',
      cell: (r) => (
        <code className="text-xs">{r.referralCode ?? '—'}</code>
      ),
    },
    { header: 'Referred', cell: (r) => r.referredCount },
    { header: 'Activated', cell: (r) => r.activatedCount },
    {
      header: 'Flag',
      cell: (r) =>
        r.abuseFlag ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
            ⚠ review
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Referrals</h1>

      <div className="flex gap-6">
        <Stat label="Total referrals" value={overview.totalReferrals} />
        <Stat label="Activated" value={overview.totalActivated} />
      </div>

      <DataTable
        data={overview.topReferrers}
        columns={columns}
        empty="No referral data yet."
      />
    </div>
  );
}
