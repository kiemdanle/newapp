import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { RevisionComparison } from '../../[id]/revision-comparison';
import { PendingActions } from '../pending-actions';
import { RecoveryActions } from '../recovery-actions';
import { ArrowLeft, Clock, GitPullRequest, AlertCircle, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RevisionDetailPage({
  params,
}: {
  params: Promise<{ editId: string }>;
}) {
  const { editId } = await params;
  const revision = await serverAdminApi.products.getPendingEdit(editId);

  if (revision.status === 'draft') {
    return (
      <div className="space-y-6">
        <Link
          href="/products/pending"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to moderation queue</span>
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-card">
          <p className="font-semibold">Unsubmitted draft</p>
          <p className="text-xs text-amber-800/80 mt-1">
            This revision is currently an unsubmitted creator draft and is not part of the active moderation queue.
          </p>
        </div>
      </div>
    );
  }

  const liveRow = await serverAdminApi.products.get(revision.productId);
  const live = { ...liveRow, photos: liveRow.photos ?? [] };
  const stale = revision.liveProductVersion !== revision.baseProductVersion;
  const awaitingResubmission = !stale && revision.status === 'changes_required';
  const alreadyResolved = !stale && (revision.status === 'approved' || revision.status === 'rejected');

  const creator = revision.creator;
  const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : null;
  const creatorDisplay = creator
    ? (creatorName ? `${creatorName} (${creator.email})` : creator.email)
    : revision.submittedBy;

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/products/pending"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to moderation queue</span>
      </Link>

      {/* Header Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs">
            <GitPullRequest size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                Product Revision
              </span>
              <span className="text-xs text-neutral-mid">
                Base v{revision.baseProductVersion} → Target v{revision.liveProductVersion}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display tracking-tight">
              Revision to {live.name}
            </h1>
            <p className="text-xs text-neutral-mid">
              Submitted by <span className="font-semibold text-neutral-dark">{creatorDisplay}</span>
              {revision.submittedAt && ` · ${new Date(revision.submittedAt).toLocaleString()}`}
            </p>
          </div>
        </div>

        <div>
          <StatusBadge status={stale ? 'changes_required' : revision.status} />
        </div>
      </div>

      {/* Prior Feedback Banner */}
      {revision.moderationFeedback && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-900 shadow-xs flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-amber-800">
              Previous Moderation Feedback
            </p>
            <p className="mt-1 text-sm text-neutral-dark">{revision.moderationFeedback}</p>
          </div>
        </div>
      )}

      {/* Revision Comparison Card */}
      <RevisionComparison live={live} revision={revision} />

      {/* Decision / Recovery Panel */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-dark mb-4">
          Moderation Action
        </h3>
        {stale ? (
          <RecoveryActions
            editId={revision.id}
            editVersion={revision.version}
            productId={revision.productId}
            productVersion={revision.liveProductVersion}
            livePhotos={live.photos}
            stagedEditPhotos={revision.photos.filter((p) => !p.retained)}
          />
        ) : awaitingResubmission ? (
          <div className="flex items-center gap-3 text-sm text-neutral-mid">
            <Clock size={18} className="text-amber-600 shrink-0" />
            <span>
              Awaiting creator resubmission. This revision was returned for changes and is not currently awaiting an admin decision.
            </span>
          </div>
        ) : alreadyResolved ? (
          <div className="flex items-center gap-3 text-sm text-neutral-mid">
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            <span>This revision has already been resolved ({revision.status}).</span>
          </div>
        ) : (
          <PendingActions editId={revision.id} />
        )}
      </div>
    </div>
  );
}
