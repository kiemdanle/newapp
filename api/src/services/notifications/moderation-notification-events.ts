import type { Prisma } from '@prisma/client';

/**
 * Durable ledger for product/edit transitions into the moderation queue.
 *
 * An event describes one successful guarded transition occurrence — never the
 * source entity — so a resubmission or a stale-edit rebase that returns to
 * `pending` records a second event keyed by the post-transition version, while
 * a replayed/stale/concurrent-losing transition records none. Callers must
 * invoke this inside the same transaction as the conditional status update,
 * after the guarded `updateMany` has succeeded: an insert failure then rolls
 * the status transition back, and a transition that lost its guard never
 * reaches this code at all.
 */
export async function recordModerationNotificationEvent(
  tx: Prisma.TransactionClient,
  input: {
    kind: 'new_product' | 'product_revision';
    sourceId: string;
    submissionVersion: number;
    submittedAt: Date;
  },
): Promise<void> {
  await tx.moderationNotificationEvent.create({
    data: {
      kind: input.kind,
      sourceId: input.sourceId,
      submissionVersion: input.submissionVersion,
      submittedAt: input.submittedAt,
    },
  });
}
