import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { Users, Package, MessageSquare, Smartphone, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AnalyticsOverviewPage() {
  const o = await serverAdminApi.analytics.overview();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight">
          Analytics Overview
        </h1>
        <p className="text-sm text-neutral-mid mt-1">
          High-level engagement, catalog growth, and scan velocity metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Users" value={o.totalUsers.toLocaleString()} icon={Users} sub="All-time registered accounts" />
        <KpiCard label="Active Users (7d)" value={o.activeUsers7d.toLocaleString()} icon={Activity} sub="Active in past 7 days" />
        <KpiCard label="Active Users (30d)" value={o.activeUsers30d.toLocaleString()} icon={Users} sub="Active in past 30 days" />
        <KpiCard label="Total Records" value={o.totalRecords.toLocaleString()} icon={Package} sub="User & household pantry items" />
        <KpiCard label="Total Reviews" value={o.totalReviews.toLocaleString()} icon={MessageSquare} sub="User-submitted product ratings" />
        <KpiCard label="Barcode Scans (7d)" value={o.scans7d.toLocaleString()} icon={Smartphone} sub="Scans performed via mobile app" />
      </div>
    </div>
  );
}
