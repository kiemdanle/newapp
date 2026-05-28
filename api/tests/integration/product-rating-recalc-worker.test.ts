// api/tests/integration/product-rating-recalc-worker.test.ts
import { describe, expect, it } from 'vitest';
import { processProductRatingRecalc } from '../../src/queues/jobs/product-rating-recalc.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('product-rating-recalc worker', () => {
  it('averages visible reviews and ignores hidden/deleted', async () => {
    const product = await makeProduct();
    const u1 = await makeUser({ email: `pr1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `pr2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `pr3-${Date.now()}@t.l` });
    const u4 = await makeUser({ email: `pr4-${Date.now()}@t.l` });
    await makeReview({
      userId: u1.id,
      productId: product.id,
      tasteRating: 5,
      valueRating: 3,
    });
    await makeReview({
      userId: u2.id,
      productId: product.id,
      tasteRating: 3,
      valueRating: 1,
    });
    await makeReview({
      userId: u3.id,
      productId: product.id,
      tasteRating: 1,
      valueRating: 1,
      status: 'hidden',
    });
    await makeReview({
      userId: u4.id,
      productId: product.id,
      tasteRating: 1,
      valueRating: 1,
      status: 'deleted',
    });

    await processProductRatingRecalc({
      data: { productId: product.id },
    } as never);

    const after = await getPrisma().product.findUnique({
      where: { id: product.id },
    });
    expect(after?.reviewCount).toBe(2);
    expect(Number(after?.tasteAvg)).toBeCloseTo(4, 2); // (5 + 3) / 2
    expect(Number(after?.valueAvg)).toBeCloseTo(2, 2); // (3 + 1) / 2
  });

  it('handles a product with zero visible reviews', async () => {
    const product = await makeProduct();
    await processProductRatingRecalc({
      data: { productId: product.id },
    } as never);
    const after = await getPrisma().product.findUnique({
      where: { id: product.id },
    });
    expect(after?.reviewCount).toBe(0);
    expect(Number(after?.tasteAvg)).toBe(0);
    expect(Number(after?.valueAvg)).toBe(0);
  });
});
