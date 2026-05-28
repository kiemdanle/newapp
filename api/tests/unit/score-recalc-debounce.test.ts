// api/tests/unit/score-recalc-debounce.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  enqueueScoreRecalc,
  getScoreRecalcQueue,
} from '../../src/queues/jobs/score-recalc.js';
import { getRedis } from '../../src/redis.js';

describe('enqueueScoreRecalc debounce', () => {
  beforeEach(async () => {
    await getRedis().flushdb();
    await getScoreRecalcQueue().obliterate({ force: true });
  });

  afterAll(async () => {
    await getScoreRecalcQueue().close();
  });

  it('first call enqueues, second within window is debounced', async () => {
    const a = await enqueueScoreRecalc('r-1');
    const b = await enqueueScoreRecalc('r-1');
    expect(a).toBe('enqueued');
    expect(b).toBe('debounced');
  });

  it('different review_ids are independent', async () => {
    const a = await enqueueScoreRecalc('r-2');
    const b = await enqueueScoreRecalc('r-3');
    expect(a).toBe('enqueued');
    expect(b).toBe('enqueued');
  });

  it('queue holds exactly one delayed job per review', async () => {
    await enqueueScoreRecalc('r-4');
    await enqueueScoreRecalc('r-4');
    await enqueueScoreRecalc('r-4');
    const counts = await getScoreRecalcQueue().getJobCounts('delayed');
    expect(counts.delayed).toBe(1);
  });
});
