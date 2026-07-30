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

  // Lead ruling: an unsubmitted creator draft never gets moderation UI — the
  // API-level admin read bypass stays (support/debugging), but the console
  // treats a draft id exactly like it's not in the queue at all.
  if (revision.status === 'draft') {
    return (
      <div className="space-y-6">
        <Link href="/products/pending" className="text-sm text-neutral-mid hover:underline">
          ← Pending queue
        </Link>
        <div className="rounded-lg border bg-neutral-light p-4 text-sm text-neutral-dark">
          This revision is an unsubmitted creator draft and is not part of the moderation queue.
        </div>
      </div>
    );
  }

  const liveRow = await serverAdminApi.products.get(revision.productId);
  // `photos` is optional on the admin row projection (omitted from some call
  // sites); this page always needs the array form.
  const live = { ...liveRow, photos: liveRow.photos ?? [] };

  // A revision is stale exactly when the live product moved on since this
  // revision was based on it — recovery (rebase/supersede), not an ordinary
  // approve/request-changes decision, is the only path forward from here.
  const stale = revision.liveProductVersion !== revision.baseProductVersion;
  // `resolveProductEdit` 409s ("Already resolved") for anything but `pending`,
  // so `changes_required` (awaiting the creator, not the admin) and any
  // terminal status get a read-only state instead of dead Approve/Request
  // -Changes buttons — the same failure mode as the new-product moderation
  // panel below, just on the revision side.
  const awaitingResubmission = !stale && revision.status === 'changes_required';
  const alreadyResolved = !stale && (revision.status === 'approved' || revision.status === 'rejected');

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
      ) : awaitingResubmission ? (
        <div className="rounded-lg border bg-neutral-light p-4 text-sm text-neutral-dark">
          Awaiting creator resubmission — not currently awaiting an admin decision. It will reappear
          in the queue once resubmitted.
        </div>
      ) : alreadyResolved ? (
        <div className="rounded-lg border bg-neutral-light p-4 text-sm text-neutral-dark">
          This revision has already been resolved ({revision.status}).
        </div>
      ) : (
        <PendingActions editId={revision.id} />
      )}
    </div>
  );
}
