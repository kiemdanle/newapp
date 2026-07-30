import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { problemSchema, versionConflictProblemSchema, ERROR_CODES } from './error.js';

const now = new Date().toISOString();

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
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
    moderationFeedback: null,
    photos: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('problemSchema', () => {
  it('parses a plain problem without structured fields', () => {
    const problem = { title: 'Not found', status: 404, code: 'not_found' };
    expect(problemSchema.parse(problem)).toEqual(problem);
  });

  it('accepts an optional currentVersion and canonicalProduct', () => {
    const product = makeProduct();
    const problem = {
      title: 'Version conflict',
      status: 409,
      code: 'version_conflict',
      currentVersion: 3,
      canonicalProduct: product,
    };
    expect(problemSchema.parse(problem)).toEqual(problem);
  });

  it('does not require canonicalProduct when currentVersion is present', () => {
    const problem = { title: 'Version conflict', status: 409, code: 'version_conflict', currentVersion: 3 };
    const parsed = problemSchema.parse(problem);
    expect(parsed).toEqual(problem);
    expect(parsed).not.toHaveProperty('canonicalProduct');
  });
});

describe('versionConflictProblemSchema', () => {
  it('requires the literal code and currentVersion', () => {
    const problem = { title: 'Version conflict', status: 409, code: 'version_conflict', currentVersion: 3 };
    expect(versionConflictProblemSchema.parse(problem)).toEqual(problem);
    expect(() =>
      versionConflictProblemSchema.parse({ title: 'x', status: 409, code: 'conflict', currentVersion: 3 }),
    ).toThrow();
    expect(() =>
      versionConflictProblemSchema.parse({ title: 'x', status: 409, code: 'version_conflict' }),
    ).toThrow();
  });

  it('allows an optional caller-visible canonicalProduct', () => {
    const product = makeProduct();
    const problem = {
      title: 'Version conflict',
      status: 409,
      code: 'version_conflict',
      currentVersion: 3,
      canonicalProduct: product,
    };
    expect(versionConflictProblemSchema.parse(problem).canonicalProduct).toEqual(product);
  });
});

describe('typed media/capacity error codes', () => {
  it('defines a stable code for every media failure mode', () => {
    expect(ERROR_CODES.VERSION_CONFLICT).toBe('version_conflict');
    expect(ERROR_CODES.UNSUPPORTED_MEDIA).toBe('unsupported_media');
    expect(ERROR_CODES.PAYLOAD_TOO_LARGE).toBe('payload_too_large');
    expect(ERROR_CODES.PIXEL_LIMIT_EXCEEDED).toBe('pixel_limit_exceeded');
    expect(ERROR_CODES.PROCESSING_TIMEOUT).toBe('processing_timeout');
    expect(ERROR_CODES.STORAGE_CAPACITY_UNAVAILABLE).toBe('storage_capacity_unavailable');
  });

  it('parses a problem for each media/capacity code', () => {
    for (const code of [
      ERROR_CODES.UNSUPPORTED_MEDIA,
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      ERROR_CODES.PIXEL_LIMIT_EXCEEDED,
      ERROR_CODES.PROCESSING_TIMEOUT,
      ERROR_CODES.STORAGE_CAPACITY_UNAVAILABLE,
    ]) {
      expect(problemSchema.parse({ title: 'x', status: 422, code })).toEqual({
        title: 'x',
        status: 422,
        code,
      });
    }
  });
});
