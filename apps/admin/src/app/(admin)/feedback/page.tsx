import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { StatusBadge } from '@/components/status-badge';
import { FilterBar, SelectFilter, TextFilter } from '@/components/filter-bar';
import {
  HelpCircle,
  Bug,
  Lightbulb,
  MessageSquare,
  ArrowRight,
  Paperclip,
  Smartphone,
} from 'lucide-react';
import type { AdminFeedbackRow } from '@expyrico/shared';

export const dynamic = 'force-dynamic';

function TypePill({ type }: { type: 'bug' | 'suggestion' | 'feedback' }) {
  if (type === 'bug') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-800 border border-red-200/80 px-2 py-0.5 text-xs font-semibold">
        <Bug size={11} className="text-red-600" />
        <span>Bug</span>
      </span>
    );
  }
  if (type === 'suggestion') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 text-xs font-semibold">
        <Lightbulb size={11} className="text-amber-600" />
        <span>Suggestion</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 text-xs font-semibold">
      <MessageSquare size={11} className="text-emerald-600" />
      <span>Feedback</span>
    </span>
  );
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = {
    status: (sp.status as any) || undefined,
    type: (sp.type as any) || undefined,
    search: sp.search || undefined,
    cursor: sp.cursor || undefined,
  };

  const [{ items, nextCursor }, counts] = await Promise.all([
    serverAdminApi.feedback.list(query),
    serverAdminApi.feedback.counts().catch(() => ({
      total: 0,
      open: 0,
      inProgress: 0,
      replied: 0,
      resolved: 0,
      closed: 0,
    })),
  ]);

  const columns: Column<AdminFeedbackRow>[] = [
    {
      header: 'Type',
      cell: (r) => <TypePill type={r.type} />,
    },
    {
      header: 'Title & Summary',
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <Link
            href={`/feedback/${r.id}`}
            className="font-semibold text-neutral-dark hover:text-primary transition-colors text-sm line-clamp-1"
          >
            {r.title}
          </Link>
          <p className="text-xs text-neutral-mid line-clamp-1 mt-0.5">{r.description}</p>
        </div>
      ),
    },
    {
      header: 'Submitted By',
      cell: (r) => {
        const fullName = `${r.user.firstName} ${r.user.lastName}`.trim();
        return (
          <div className="text-xs min-w-0">
            <Link
              href={`/users/${r.user.id}`}
              className="font-semibold text-neutral-dark hover:underline block truncate max-w-[160px]"
            >
              {fullName || r.user.email}
            </Link>
            <span className="text-neutral-mid block text-[11px] truncate max-w-[160px]">
              {r.user.email}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Device',
      cell: (r) => {
        if (!r.deviceInfo) return <span className="text-xs text-neutral-mid">—</span>;
        const dev = r.deviceInfo;
        const label = [dev.platform, dev.osVersion, dev.deviceModel].filter(Boolean).join(' • ');
        return (
          <div className="flex items-center gap-1 text-xs text-neutral-dark" title={label}>
            <Smartphone size={12} className="text-neutral-mid shrink-0" />
            <span className="font-mono text-[11px] truncate max-w-[140px]">
              {dev.platform.toUpperCase()} {dev.osVersion}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Files',
      cell: (r) => {
        const count = r.attachmentsCount ?? r.attachments?.length ?? 0;
        if (count === 0) return <span className="text-xs text-neutral-mid">—</span>;
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-dark">
            <Paperclip size={12} className="text-neutral-mid" />
            <span>{count}</span>
          </span>
        );
      },
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Submitted',
      cell: (r) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (r) => (
        <Link
          href={`/feedback/${r.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-dark hover:border-primary hover:text-primary transition-colors shadow-xs"
        >
          <span>View</span>
          <ArrowRight size={11} />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <HelpCircle size={14} />
          <span>Support & Community</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-4 mt-1">
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight">
            User Feedback & Bug Reports
          </h1>
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-mid">
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-semibold">
              {counts.open} Open
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 font-semibold">
              {counts.inProgress} In Progress
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5 font-semibold">
              {counts.total} Total
            </span>
          </div>
        </div>
        <p className="text-sm text-neutral-mid mt-0.5">
          Review bug reports, suggestions, and feedback submitted by mobile users. Reply to tickets and resolve cases.
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar action="/feedback">
        <SelectFilter
          name="type"
          label="Type"
          value={sp.type}
          options={[
            { value: 'bug', label: 'Bug Reports' },
            { value: 'suggestion', label: 'Suggestions' },
            { value: 'feedback', label: 'Feedback' },
          ]}
        />
        <SelectFilter
          name="status"
          label="Status"
          value={sp.status}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'replied', label: 'Replied' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <TextFilter
          name="search"
          label="Search"
          placeholder="Title, description, user..."
          value={sp.search}
        />
      </FilterBar>

      {/* Data Table */}
      <DataTable
        data={items}
        columns={columns}
        empty="No feedback submissions match the current filters."
      />

      <LoadMore basePath="/feedback" params={sp} nextCursor={nextCursor} />
    </div>
  );
}
