import { describe, expect, it } from 'vitest';
import {
  reviewCreateSchema,
  reviewListQuerySchema,
  reviewPatchSchema,
  reviewSchema,
  reviewSortSchema,
  reviewStatusSchema,
} from '@expyrico/shared';

describe('reviewStatusSchema', () => {
  it('accepts the three valid statuses', () => {
    expect(reviewStatusSchema.parse('visible')).toBe('visible');
    expect(reviewStatusSchema.parse('hidden')).toBe('hidden');
    expect(reviewStatusSchema.parse('deleted')).toBe('deleted');
  });

  it('rejects unknown status', () => {
    expect(() => reviewStatusSchema.parse('pending')).toThrow();
  });
});

describe('reviewCreateSchema', () => {
  it('accepts a valid rating with optional body', () => {
    const r = reviewCreateSchema.parse({ rating: 'buy_again', body: 'great' });
    expect(r).toEqual({ rating: 'buy_again', body: 'great' });
  });

  it('accepts missing body', () => {
    const r = reviewCreateSchema.parse({ rating: 'wont_buy' });
    expect(r.rating).toBe('wont_buy');
    expect(r.body).toBeUndefined();
  });

  it('rejects unknown rating value', () => {
    expect(() => reviewCreateSchema.parse({ rating: 'meh' })).toThrow();
  });

  it('rejects missing rating', () => {
    expect(() => reviewCreateSchema.parse({})).toThrow();
  });

  it('rejects body over 2000 chars', () => {
    expect(() =>
      reviewCreateSchema.parse({ rating: 'buy_again', body: 'x'.repeat(2001) }),
    ).toThrow();
  });
});

describe('reviewPatchSchema', () => {
  it('accepts rating only', () => {
    expect(reviewPatchSchema.parse({ rating: 'buy_again_on_sale' })).toEqual({
      rating: 'buy_again_on_sale',
    });
  });

  it('accepts body only', () => {
    expect(reviewPatchSchema.parse({ body: 'updated' })).toEqual({ body: 'updated' });
  });

  it('rejects an empty patch', () => {
    expect(() => reviewPatchSchema.parse({})).toThrow();
  });
});

describe('reviewSortSchema', () => {
  it('defaults to score', () => {
    expect(reviewSortSchema.parse(undefined)).toBe('score');
  });

  it('accepts the three sort modes', () => {
    expect(reviewSortSchema.parse('score')).toBe('score');
    expect(reviewSortSchema.parse('new')).toBe('new');
    expect(reviewSortSchema.parse('rating')).toBe('rating');
  });

  it('rejects unknown sorts', () => {
    expect(() => reviewSortSchema.parse('popular')).toThrow();
  });
});

describe('reviewListQuerySchema', () => {
  it('coerces string limit and applies defaults', () => {
    const r = reviewListQuerySchema.parse({ limit: '10' });
    expect(r.limit).toBe(10);
    expect(r.sort).toBe('score');
  });

  it('clamps limit upper bound', () => {
    expect(() => reviewListQuerySchema.parse({ limit: 51 })).toThrow();
  });
});

describe('reviewSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000aaa',
    userId: '00000000-0000-0000-0000-000000000bbb',
    productId: '00000000-0000-0000-0000-000000000ccc',
    rating: 'buy_again' as const,
    body: null,
    helpfulCount: 0,
    notHelpfulCount: 0,
    score: 0,
    status: 'visible' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('parses a minimal review payload', () => {
    expect(reviewSchema.parse(base).status).toBe('visible');
  });

  it('parses myVote helpful/not_helpful and null', () => {
    expect(reviewSchema.parse({ ...base, myVote: 'helpful' }).myVote).toBe('helpful');
    expect(reviewSchema.parse({ ...base, myVote: 'not_helpful' }).myVote).toBe('not_helpful');
    expect(reviewSchema.parse({ ...base, myVote: null }).myVote).toBeNull();
  });

  it('rejects unknown myVote', () => {
    expect(() => reviewSchema.parse({ ...base, myVote: 1 })).toThrow();
  });

  it('rejects score > 1', () => {
    expect(() => reviewSchema.parse({ ...base, score: 1.5 })).toThrow();
  });
});
