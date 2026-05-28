// api/tests/integration/score-recalc-worker.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'bullmq';
import { getQueueConnection } from '../../src/queues/index.js';
import {
  SCORE_RECALC_QUEUE,
  getScoreRecalcQueue,
  processScoreRecalc,
} from '../../src/queues/jobs/score-recalc.js';
import { makeProduct, makeReview, makeUser, makeVote } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('score-recalc worker', () => {
  let worker: Worker;

  beforeEach(async () => {
    await getScoreRecalcQueue().obliterate({ force: true });
  });

  afterAll(async () => {
    if (worker) await worker.close();
    await getScoreRecalcQueue().close();
  });

  it("updates a review's denormalized counts and Wilson score", async () => {
    const author = await makeUser({ email: `wa-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    const v1 = await makeUser({ email: `wv1-${Date.now()}@t.l` });
    const v2 = await makeUser({ email: `wv2-${Date.now()}@t.l` });
    const v3 = await makeUser({ email: `wv3-${Date.now()}@t.l` });
    await makeVote({ userId: v1.id, reviewId: review.id, value: 1 });
    await makeVote({ userId: v2.id, reviewId: review.id, value: 1 });
    await makeVote({ userId: v3.id, reviewId: review.id, value: -1 });

    // Process inline (skip the 30s delay)
    await processScoreRecalc({ data: { reviewId: review.id } } as never);

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.upvoteCount).toBe(2);
    expect(after?.downvoteCount).toBe(1);
    expect(Number(after?.score)).toBeGreaterThan(0);
    expect(Number(after?.score)).toBeLessThan(1);
  });

  it('uses the same worker entry point via BullMQ end-to-end', async () => {
    const author = await makeUser({ email: `wb-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    const v1 = await makeUser({ email: `wb1-${Date.now()}@t.l` });
    await makeVote({ userId: v1.id, reviewId: review.id, value: 1 });

    worker = new Worker(SCORE_RECALC_QUEUE, processScoreRecalc, {
      connection: getQueueConnection(),
    });
    await getScoreRecalcQueue().add(SCORE_RECALC_QUEUE, { reviewId: review.id });
    await new Promise<void>((resolve) => worker.on('completed', () => resolve()));

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.upvoteCount).toBe(1);
  });
});
