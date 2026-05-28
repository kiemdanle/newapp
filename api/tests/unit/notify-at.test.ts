import { describe, expect, it } from 'vitest';
import {
  computeNotifyAt,
  DEFAULT_OFFSETS_DAYS,
  resolveOffsetsForUser,
} from '../../src/services/records/notify-at.js';

describe('resolveOffsetsForUser', () => {
  it('returns the default offsets when prefs is null', () => {
    expect(resolveOffsetsForUser(null)).toEqual([3, 1, 0]);
  });
  it('returns the default offsets when offsetsDays is missing/malformed', () => {
    expect(resolveOffsetsForUser({})).toEqual([3, 1, 0]);
    expect(resolveOffsetsForUser({ offsetsDays: 'nope' })).toEqual([3, 1, 0]);
  });
  it('returns the stored offsetsDays when valid', () => {
    expect(resolveOffsetsForUser({ offsetsDays: [14, 3] })).toEqual([14, 3]);
  });
});

describe('computeNotifyAt', () => {
  // Pin `now` so tests are deterministic regardless of when the suite runs.
  const NOW = new Date('2026-01-01T00:00:00Z');

  it('returns timestamps for the default 3/1/0 offsets at 09:00 user-local UTC', () => {
    const expiry = new Date('2026-01-15');
    const out = computeNotifyAt(expiry, undefined, NOW);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('2026-01-12T09:00:00.000Z'); // 3d before
    expect(out[1]).toBe('2026-01-14T09:00:00.000Z'); // 1d before
    expect(out[2]).toBe('2026-01-15T09:00:00.000Z'); // day of
  });

  it('filters past timestamps relative to now', () => {
    const expiry = new Date('2026-01-15');
    const now = new Date('2026-01-14T12:00:00Z');
    const out = computeNotifyAt(expiry, undefined, now);
    expect(out).toEqual(['2026-01-15T09:00:00.000Z']);
  });

  it('uses custom offsets when provided', () => {
    const expiry = new Date('2026-06-01');
    const out = computeNotifyAt(expiry, [14, 3], NOW);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('2026-05-18T09:00:00.000Z');
    expect(out[1]).toBe('2026-05-29T09:00:00.000Z');
  });

  it('deduplicates and sorts ascending', () => {
    const expiry = new Date('2026-06-01');
    const out = computeNotifyAt(expiry, [3, 3, 1], NOW);
    expect(out).toEqual([
      '2026-05-29T09:00:00.000Z',
      '2026-05-31T09:00:00.000Z',
    ]);
  });

  it('exports DEFAULT_OFFSETS_DAYS = [3,1,0]', () => {
    expect(DEFAULT_OFFSETS_DAYS).toEqual([3, 1, 0]);
  });
});
