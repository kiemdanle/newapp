import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const o = await serverAdminApi.analytics.overview();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total users" value={o.totalUsers.toLocaleString()} />
        <KpiCard label="Active (7d)" value={o.activeUsers7d.toLocaleString()} />
        <KpiCard label="Active (30d)" value={o.activeUsers30d.toLocaleString()} />
        <KpiCard label="Total records" value={o.totalRecords.toLocaleString()} />
        <KpiCard label="Total reviews" value={o.totalReviews.toLocaleString()} />
        <KpiCard label="Scans (7d)" value={o.scans7d.toLocaleString()} />
      </div>
    </div>
  );
}
