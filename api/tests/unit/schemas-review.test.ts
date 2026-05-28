import { describe, expect, it } from 'vitest';
import {
  reviewCreateSchema,
  reviewListQuerySchema,
  reviewPatchSchema,
  reviewSchema,
  reviewSortSchema,
  reviewStatusSchema,
} from '@pantry/shared';

describe('reviewStatusSchema', () => {
  it('accepts the three valid statuses', () => {
    expect(reviewStatusSchema.parse('visible')).toBe('visible');
    expect(reviewStatusSchema.parse('hidden')).toBe('hidden');
    expect(reviewStatusSchema.parse('deleted')).toBe('deleted');
  });

  it('rejects pending — not a valid status per D15', () => {
    expect(() => reviewStatusSchema.parse('pending')).toThrow();
  });
});

describe('reviewCreateSchema', () => {
  it('accepts both ratings 1–5 with optional body', () => {
    const r = reviewCreateSchema.parse({
      tasteRating: 4,
      valueRating: 5,
      body: 'tasty',
    });
    expect(r).toEqual({ tasteRating: 4, valueRating: 5, body: 'tasty' });
  });

  it('accepts missing body', () => {
    const r = reviewCreateSchema.parse({ tasteRating: 1, valueRating: 1 });
    expect(r.tasteRating).toBe(1);
    expect(r.valueRating).toBe(1);
    expect(r.body).toBeUndefined();
  });

  it('rejects rating 0 or 6 on either field', () => {
    expect(() => reviewCreateSchema.parse({ tasteRating: 0, valueRating: 3 })).toThrow();
    expect(() => reviewCreateSchema.parse({ tasteRating: 3, valueRating: 6 })).toThrow();
  });

  it('rejects non-integer ratings', () => {
    expect(() => reviewCreateSchema.parse({ tasteRating: 3.5, valueRating: 3 })).toThrow();
  });

  it('rejects body over 2000 chars', () => {
    expect(() =>
      reviewCreateSchema.parse({
        tasteRating: 5,
        valueRating: 5,
        body: 'x'.repeat(2001),
      }),
    ).toThrow();
  });

  it('rejects missing tasteRating or valueRating (NOT NULL pair)', () => {
    expect(() => reviewCreateSchema.parse({ valueRating: 3 })).toThrow();
    expect(() => reviewCreateSchema.parse({ tasteRating: 3 })).toThrow();
  });
});

describe('reviewPatchSchema', () => {
  it('accepts a single field', () => {
    expect(reviewPatchSchema.parse({ tasteRating: 4 })).toEqual({ tasteRating: 4 });
    expect(reviewPatchSchema.parse({ valueRating: 4 })).toEqual({ valueRating: 4 });
    expect(reviewPatchSchema.parse({ body: 'updated' })).toEqual({ body: 'updated' });
  });

  it('rejects an empty patch', () => {
    expect(() => reviewPatchSchema.parse({})).toThrow();
  });

  it('rejects rating out of range', () => {
    expect(() => reviewPatchSchema.parse({ tasteRating: 7 })).toThrow();
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
    expect(() => reviewSortSchema.parse('helpful')).toThrow();
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
    tasteRating: 5,
    valueRating: 4,
    body: null,
    upvoteCount: 0,
    downvoteCount: 0,
    score: 0,
    status: 'visible' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('parses a minimal review payload', () => {
    expect(reviewSchema.parse(base).status).toBe('visible');
  });

  it('parses myVote ±1 and null', () => {
    expect(reviewSchema.parse({ ...base, myVote: 1 }).myVote).toBe(1);
    expect(reviewSchema.parse({ ...base, myVote: -1 }).myVote).toBe(-1);
    expect(reviewSchema.parse({ ...base, myVote: null }).myVote).toBeNull();
  });

  it('rejects myVote 0 or 2', () => {
    expect(() => reviewSchema.parse({ ...base, myVote: 0 })).toThrow();
    expect(() => reviewSchema.parse({ ...base, myVote: 2 })).toThrow();
  });

  it('rejects score > 1', () => {
    expect(() => reviewSchema.parse({ ...base, score: 1.5 })).toThrow();
  });
});
