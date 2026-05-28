// api/tests/integration/moderation-flag-worker.test.ts
import { describe, expect, it } from 'vitest';
import { processModerationFlag } from '../../src/queues/jobs/moderation-flag.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('moderation-flag worker', () => {
  it('hides profane reviews and inserts a system report', async () => {
    const user = await makeUser({ email: `mf-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({
      userId: user.id,
      productId: product.id,
      body: 'this product is shit',
    });
    await processModerationFlag({ data: { reviewId: review.id } } as never);

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.status).toBe('hidden');
    const reports = await getPrisma().report.findMany({
      where: { targetId: review.id },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]!.reporterId).toBe('00000000-0000-0000-0000-000000000001');
    expect(reports[0]!.reason).toBe('abuse');
    expect(reports[0]!.body).toMatch(/auto-flagged:/);
  });

  it('no-ops on clean content', async () => {
    const user = await makeUser({ email: `cl-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({
      userId: user.id,
      productId: product.id,
      body: 'really enjoyed this',
    });
    await processModerationFlag({ data: { reviewId: review.id } } as never);
    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.status).toBe('visible');
    const reports = await getPrisma().report.count({
      where: { targetId: review.id },
    });
    expect(reports).toBe(0);
  });
});
