import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Package,
  MessageSquare,
  Smartphone,
  Clock,
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [o, moderationSummary] = await Promise.all([
    serverAdminApi.analytics.overview(),
    serverAdminApi.system.moderationNotifications.summary(),
  ]);

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Platform Overview</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Dashboard Overview
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Real-time platform activity, community submissions, and system health.
          </p>
        </div>

        {/* Quick Action to Moderation */}
        <div className="flex items-center gap-3">
          <Button asChild variant="default" className="rounded-xl shadow-xs gap-2">
            <Link href="/products/pending">
              <Clock size={16} />
              <span>Review Queue</span>
              {moderationSummary.total > 0 && (
                <span className="ml-1 rounded-full bg-accent text-accent-foreground font-bold px-1.5 py-0.2 text-xs">
                  {moderationSummary.total}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl shadow-xs gap-1.5">
            <Link href="/products">
              <Package size={16} />
              <span>Catalog</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Users"
          value={o.totalUsers.toLocaleString()}
          icon={Users}
          sub="Registered accounts"
        />
        <KpiCard
          label="Active Users (7d)"
          value={o.activeUsers7d.toLocaleString()}
          icon={Activity}
          trend={`${Math.round((o.activeUsers7d / Math.max(o.totalUsers, 1)) * 100)}% of total`}
          trendUp={true}
        />
        <KpiCard
          label="Active Users (30d)"
          value={o.activeUsers30d.toLocaleString()}
          icon={Users}
          sub="Monthly engagement"
        />
        <KpiCard
          label="Pantry Records"
          value={o.totalRecords.toLocaleString()}
          icon={Package}
          sub="Tracked pantry items"
        />
        <KpiCard
          label="Product Reviews"
          value={o.totalReviews.toLocaleString()}
          icon={MessageSquare}
          sub="Community ratings"
        />
        <KpiCard
          label="Barcode Scans (7d)"
          value={o.scans7d.toLocaleString()}
          icon={Smartphone}
          sub="Past 7 days"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Moderation Card */}
        <div className="group rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-dropdown transition-all flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 mb-4">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-dark font-display">
              Moderation Queue
            </h3>
            <p className="text-xs text-neutral-mid mt-1 leading-relaxed">
              Review pending creator submissions, product edits, and community reports.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="text-xs font-semibold text-neutral-mid">
              {moderationSummary.total} items pending
            </span>
            <Link
              href="/products/pending"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform"
            >
              <span>Review now</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Catalog Card */}
        <div className="group rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-dropdown transition-all flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light/50 text-primary-dark border border-primary/20 mb-4">
              <Package size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-dark font-display">
              Product Catalog
            </h3>
            <p className="text-xs text-neutral-mid mt-1 leading-relaxed">
              Browse products, inspect photo sets, manage merges, and update classifications.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="text-xs font-semibold text-neutral-mid">
              OpenFoodFacts & UPC databases
            </span>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform"
            >
              <span>Explore catalog</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Security & System Card */}
        <div className="group rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-dropdown transition-all flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 border border-neutral-200 mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-dark font-display">
              Security & Health
            </h3>
            <p className="text-xs text-neutral-mid mt-1 leading-relaxed">
              Monitor operational health, background queue workers, and audit logs.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 size={13} />
              <span>Operational</span>
            </span>
            <Link
              href="/system/queue"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform"
            >
              <span>Inspect queues</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
