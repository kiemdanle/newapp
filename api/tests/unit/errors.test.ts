import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Product } from '@expyrico/shared';
import { AppError, toProblem } from '../../src/errors.js';

function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    barcode: '5449000000996',
    qrPayload: null,
    name: 'Coke',
    description: null,
    brand: null,
    category: null,
    imageUrl: null,
    defaultShelfLifeDays: null,
    source: 'user',
    sourceId: null,
    isCommunityEligible: false,
    buyAgainCount: 0,
    buyAgainOnSaleCount: 0,
    wontBuyCount: 0,
    ratingCount: 0,
    reviewCount: 0,
    status: 'active',
    version: 1,
    photos: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('toProblem', () => {
  it('maps AppError', () => {
    const err = new AppError({ status: 404, code: 'not_found', title: 'Not found' });
    const p = toProblem(err);
    expect(p.status).toBe(404);
    expect(p.code).toBe('not_found');
    expect(p.title).toBe('Not found');
  });

  it('maps a version_conflict AppError with currentVersion but no canonicalProduct', () => {
    const err = new AppError({
      status: 409,
      code: 'version_conflict',
      title: 'Version conflict',
      currentVersion: 4,
    });
    const p = toProblem(err);
    expect(p.status).toBe(409);
    expect(p.code).toBe('version_conflict');
    expect(p.currentVersion).toBe(4);
    expect(p).not.toHaveProperty('canonicalProduct');
  });

  it('includes canonicalProduct only when the caller is explicitly allowed to see it', () => {
    const product = makeProduct();
    const err = new AppError({
      status: 409,
      code: 'version_conflict',
      title: 'Version conflict',
      currentVersion: 4,
      canonicalProduct: product,
    });
    const p = toProblem(err);
    expect(p.canonicalProduct).toEqual(product);
  });

  it('never leaks a hidden canonical product through serialization', () => {
    const err = new AppError({ status: 409, code: 'version_conflict', title: 'Version conflict', currentVersion: 4 });
    const p = toProblem(err);
    expect(JSON.stringify(p)).not.toContain('canonicalProduct');
  });

  it('maps ZodError to 400 validation_error with field paths', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'nope' });
    if (result.success) throw new Error('expected failure');
    const p = toProblem(result.error);
    expect(p.status).toBe(400);
    expect(p.code).toBe('validation_error');
    expect(p.errors?.[0]?.path).toBe('email');
  });

  it('maps unknown error to 500', () => {
    const p = toProblem(new Error('boom'));
    expect(p.status).toBe(500);
    expect(p.code).toBe('internal_error');
  });
});
