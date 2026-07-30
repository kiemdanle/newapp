import Link from 'next/link';
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { RevisionComparison } from '../../[id]/revision-comparison';
import { PendingActions } from '../pending-actions';
import { RecoveryActions } from '../recovery-actions';

export const dynamic = 'force-dynamic';

export default async function RevisionDetailPage({
  params,
}: {
  params: Promise<{ editId: string }>;
}) {
  const { editId } = await params;
  const revision = await serverAdminApi.products.getPendingEdit(editId);
  const liveRow = await serverAdminApi.products.get(revision.productId);
  // `photos` is optional on the admin row projection (omitted from some call
  // sites); this page always needs the array form.
  const live = { ...liveRow, photos: liveRow.photos ?? [] };

  // A revision is stale exactly when the live product moved on since this
  // revision was based on it — recovery (rebase/supersede), not an ordinary
  // approve/request-changes decision, is the only path forward from here.
  const stale = revision.liveProductVersion !== revision.baseProductVersion;

  return (
    <div className="space-y-6">
      <Link href="/products/pending" className="text-sm text-neutral-mid hover:underline">
        ← Pending queue
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-neutral-dark font-display">
            Revision to {live.name}
          </h1>
          <p className="text-xs text-neutral-mid">
            Submitted by <span className="font-mono">{revision.submittedBy}</span>
            {revision.submittedAt && ` · ${new Date(revision.submittedAt).toLocaleString()}`}
          </p>
        </div>
        <StatusBadge status={stale ? 'changes_required' : revision.status} />
      </div>

      {revision.moderationFeedback && (
        <p className="rounded-md border bg-neutral-light p-3 text-sm text-neutral-dark">
          Previous feedback: {revision.moderationFeedback}
        </p>
      )}

      <RevisionComparison live={live} revision={revision} />

      {stale ? (
        <RecoveryActions
          editId={revision.id}
          editVersion={revision.version}
          productId={live.id}
          productVersion={revision.liveProductVersion}
          livePhotos={live.photos}
          stagedEditPhotos={revision.photos.filter((p) => !p.retained)}
        />
      ) : (
        <PendingActions editId={revision.id} />
      )}
    </div>
  );
}
