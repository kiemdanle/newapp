// api/src/queues/jobs/score-recalc.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { wilsonLowerBound } from '../../services/reviews/wilson.js';

export const SCORE_RECALC_QUEUE = 'score-recalc';
export const SCORE_DEBOUNCE_TTL_SECONDS = 30;

interface ScoreRecalcData {
  reviewId: string;
}

let _queue: Queue<ScoreRecalcData> | undefined;
export function getScoreRecalcQueue(): Queue<ScoreRecalcData> {
  if (!_queue) {
    _queue = new Queue<ScoreRecalcData>(SCORE_RECALC_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _queue;
}

/**
 * Debounced enqueue. The first event for a review_id within the TTL window
 * enqueues a delayed job; subsequent events within the window are dropped.
 * The TTL key expires before the worker runs, so the next vote after the
 * job fires will queue again.
 */
export async function enqueueScoreRecalc(
  reviewId: string,
): Promise<'enqueued' | 'debounced'> {
  const redis = getRedis();
  const key = `score-recalc:${reviewId}`;
  // SET key 1 NX EX 30 → returns 'OK' only if not set
  const set = await redis.set(key, '1', 'EX', SCORE_DEBOUNCE_TTL_SECONDS, 'NX');
  if (set !== 'OK') return 'debounced';
  await getScoreRecalcQueue().add(
    SCORE_RECALC_QUEUE,
    { reviewId },
    {
      delay: SCORE_DEBOUNCE_TTL_SECONDS * 1000,
      // BullMQ 5 disallows ':' in custom job IDs.
      jobId: `score-recalc-${reviewId}`,
      removeOnComplete: 1000,
      removeOnFail: 100,
    },
  );
  return 'enqueued';
}

export async function processScoreRecalc(
  job: Job<ScoreRecalcData>,
): Promise<void> {
  const { reviewId } = job.data;
  const prisma = getPrisma();
  const agg = await prisma.reviewVote.groupBy({
    by: ['value'],
    where: { reviewId },
    _count: { _all: true },
  });
  let up = 0;
  let down = 0;
  for (const row of agg) {
    if (row.value === 1) up = row._count._all;
    else if (row.value === -1) down = row._count._all;
  }
  const score = wilsonLowerBound(up, down);
  await prisma.review.update({
    where: { id: reviewId },
    data: { upvoteCount: up, downvoteCount: down, score },
  });
}

export function startScoreRecalcWorker(): Worker<ScoreRecalcData> {
  return new Worker<ScoreRecalcData>(SCORE_RECALC_QUEUE, processScoreRecalc, {
    connection: getQueueConnection(),
    concurrency: 4,
  });
}
