import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { ReportActions } from './report-actions';

export const dynamic = 'force-dynamic';

// The API exposes report list + resolve (no by-id GET); each list row already
// carries the target preview, so the detail view locates the report within the
// queue. A generous limit covers the open queue an admin navigates from.
export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { items } = await serverAdminApi.reports.list({ limit: 200 });
  const report = items.find((r) => r.id === id);

  if (!report) {
    return (
      <div className="space-y-4">
        <Link href="/reports" className="text-sm text-neutral-mid hover:underline">
          ← Reports
        </Link>
        <p className="text-sm text-neutral-mid">
          Report not found in the current queue (it may be older than the loaded window).
        </p>
      </div>
    );
  }

  const preview = report.targetPreview as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-neutral-mid hover:underline">
        ← Reports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-neutral-dark font-display capitalize">
            {report.targetType} report — {report.reason}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={report.status} />
            <span className="text-xs text-neutral-mid">
              {new Date(report.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        {report.status === 'open' && (
          <ReportActions id={report.id} targetType={report.targetType} />
        )}
      </div>

      {report.body && (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Reporter note</h2>
          <p className="text-sm text-neutral-mid">{report.body}</p>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Reported {report.targetType}</h2>
        {preview ? (
          <dl className="rounded-lg border p-4 text-sm">
            {Object.entries(preview).map(([k, v]) => (
              <div key={k} className="flex gap-2 py-0.5">
                <dt className="w-28 shrink-0 text-neutral-mid">{k}</dt>
                <dd className="break-all">{String(v ?? '—')}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-neutral-mid">Target no longer exists.</p>
        )}
        <p className="text-xs text-neutral-mid">Target id: {report.targetId}</p>
      </div>
    </div>
  );
}
