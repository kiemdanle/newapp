import { describe, expect, it } from 'vitest';
import { reviewVoteSchema, voteSchema } from '@pantry/shared';

describe('reviewVoteSchema (a.k.a. voteSchema)', () => {
  it('exports the same schema under both names', () => {
    expect(voteSchema).toBe(reviewVoteSchema);
  });

  it('accepts helpful', () => {
    expect(reviewVoteSchema.parse({ value: 'helpful' })).toEqual({ value: 'helpful' });
  });

  it('accepts not_helpful', () => {
    expect(reviewVoteSchema.parse({ value: 'not_helpful' })).toEqual({ value: 'not_helpful' });
  });

  it('rejects unknown values', () => {
    expect(() => reviewVoteSchema.parse({ value: 'neutral' })).toThrow();
    expect(() => reviewVoteSchema.parse({ value: 1 })).toThrow();
    expect(() => reviewVoteSchema.parse({ value: -1 })).toThrow();
  });

  it('rejects missing value', () => {
    expect(() => reviewVoteSchema.parse({})).toThrow();
  });
});
