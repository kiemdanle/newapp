import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { Users, Package, MessageSquare, Smartphone } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const o = await serverAdminApi.analytics.overview();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Overview</h1>
        <p className="text-sm text-neutral-mid mt-1">Key metrics across the Expyrico platform.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total users" value={o.totalUsers.toLocaleString()} icon={Users} trend="All time" />
        <KpiCard label="Active (7d)" value={o.activeUsers7d.toLocaleString()} icon={Users} />
        <KpiCard label="Active (30d)" value={o.activeUsers30d.toLocaleString()} icon={Users} />
        <KpiCard label="Total records" value={o.totalRecords.toLocaleString()} icon={Package} />
        <KpiCard label="Total reviews" value={o.totalReviews.toLocaleString()} icon={MessageSquare} />
        <KpiCard label="Scans (7d)" value={o.scans7d.toLocaleString()} icon={Smartphone} />
      </div>
    </div>
  );
}
