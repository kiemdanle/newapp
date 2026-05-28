import { describe, expect, it } from 'vitest';
import { reviewVoteSchema, voteSchema } from '@pantry/shared';

describe('reviewVoteSchema (a.k.a. voteSchema)', () => {
  it('exports the same schema under both names', () => {
    expect(voteSchema).toBe(reviewVoteSchema);
  });

  it('accepts +1 (upvote)', () => {
    expect(reviewVoteSchema.parse({ value: 1 })).toEqual({ value: 1 });
  });

  it('accepts -1 (downvote)', () => {
    expect(reviewVoteSchema.parse({ value: -1 })).toEqual({ value: -1 });
  });

  it('rejects 0 (no neutral vote)', () => {
    expect(() => reviewVoteSchema.parse({ value: 0 })).toThrow();
  });

  it('rejects values outside ±1', () => {
    expect(() => reviewVoteSchema.parse({ value: 2 })).toThrow();
    expect(() => reviewVoteSchema.parse({ value: -2 })).toThrow();
  });

  it('rejects strings even when coercible', () => {
    expect(() => reviewVoteSchema.parse({ value: '1' })).toThrow();
  });

  it('rejects missing value', () => {
    expect(() => reviewVoteSchema.parse({})).toThrow();
  });
});
