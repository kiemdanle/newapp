import { describe, expect, it } from 'vitest';
import { inferRaterRole } from '../../src/services/giveaways/ratings.js';

describe('inferRaterRole', () => {
  const giveaway = { giverUserId: 'g-1', selectedRecipientId: 'r-1' };

  it('returns giver when rater is giver', () => {
    expect(inferRaterRole(giveaway, 'g-1')).toEqual({ role: 'giver', rateeUserId: 'r-1' });
  });
  it('returns recipient when rater is selected recipient', () => {
    expect(inferRaterRole(giveaway, 'r-1')).toEqual({ role: 'recipient', rateeUserId: 'g-1' });
  });
  it('returns null when rater is neither party', () => {
    expect(inferRaterRole(giveaway, 'x-9')).toBeNull();
  });
});
