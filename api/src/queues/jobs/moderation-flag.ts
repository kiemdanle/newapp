// api/src/queues/jobs/moderation-flag.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { SYSTEM_USER_ID } from '../../services/reviews/system-user.js';
import { maybeAutoHide } from '../../services/reports/repository.js';

export const MODERATION_FLAG_QUEUE = 'moderation-flag';

interface ModerationFlagData {
  reviewId: string;
}

let _queue: Queue<ModerationFlagData> | undefined;
export function getModerationFlagQueue(): Queue<ModerationFlagData> {
  if (!_queue) {
    _queue = new Queue<ModerationFlagData>(MODERATION_FLAG_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _queue;
}

export async function enqueueModerationFlag(reviewId: string): Promise<void> {
  await getModerationFlagQueue().add(
    MODERATION_FLAG_QUEUE,
    { reviewId },
    { removeOnComplete: 1000, removeOnFail: 100 },
  );
}

export async function processModerationFlag(
  job: Job<ModerationFlagData>,
): Promise<void> {
  const { reviewId } = job.data;
  const prisma = getPrisma();
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.status === 'deleted') return;

  const { matched, words } = containsProfanity(review.body);
  if (!matched) return;

  // Per D15: no `pending` status. Auto-flag goes straight to `hidden`; the
  // accompanying system Report row is the signal admins use to triage.
  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { status: 'hidden' },
    }),
    prisma.report.create({
      data: {
        reporterId: SYSTEM_USER_ID,
        targetType: 'review',
        targetId: reviewId,
        reason: 'abuse',
        body: `auto-flagged: ${words.join(', ')}`,
      },
    }),
  ]);

  // Auto-hide if threshold already exceeded (e.g., previous user reports + this one)
  await maybeAutoHide('review', reviewId);
}

export function startModerationFlagWorker(): Worker<ModerationFlagData> {
  return new Worker<ModerationFlagData>(
    MODERATION_FLAG_QUEUE,
    processModerationFlag,
    {
      connection: getQueueConnection(),
      concurrency: 4,
    },
  );
}
