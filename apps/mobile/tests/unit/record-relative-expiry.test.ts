import { getRelativeExpiryLabel } from '../../app/(app)/record/[id]';

describe('getRelativeExpiryLabel in pantry item detail', () => {
  const fixedNow = new Date('2026-09-06T12:00:00Z');

  it('displays overdue label for expired pantry items', () => {
    expect(getRelativeExpiryLabel('2026-09-04', 'US', fixedNow)).toBe('2d overdue');
    expect(getRelativeExpiryLabel('2026-09-01', 'US', fixedNow)).toBe('5d overdue');
  });

  it('displays "Expires today" when expiring on the same day', () => {
    expect(getRelativeExpiryLabel('2026-09-06', 'US', fixedNow)).toBe('Expires today');
  });

  it('displays "Tomorrow" when expiring in 1 day', () => {
    expect(getRelativeExpiryLabel('2026-09-07', 'US', fixedNow)).toBe('Tomorrow');
  });

  it('displays "In X days" when nearly expiring (2 to 7 days)', () => {
    expect(getRelativeExpiryLabel('2026-09-08', 'US', fixedNow)).toBe('In 2 days');
    expect(getRelativeExpiryLabel('2026-09-11', 'US', fixedNow)).toBe('In 5 days');
    expect(getRelativeExpiryLabel('2026-09-13', 'US', fixedNow)).toBe('In 7 days');
  });

  it('displays "In X days" instead of duplicated date when the item is still fresh (> 7 days)', () => {
    // Previously returned formatDate (e.g. "09/14/2026"), causing duplicated dates with subtext
    expect(getRelativeExpiryLabel('2026-09-14', 'US', fixedNow)).toBe('In 8 days');
    expect(getRelativeExpiryLabel('2026-09-20', 'US', fixedNow)).toBe('In 14 days');
    expect(getRelativeExpiryLabel('2026-10-06', 'US', fixedNow)).toBe('In 30 days');
    expect(getRelativeExpiryLabel('2026-12-05', 'US', fixedNow)).toBe('In 90 days');
    expect(getRelativeExpiryLabel('2027-09-06', 'US', fixedNow)).toBe('In 365 days');
  });

  it('handles empty or missing date string gracefully', () => {
    expect(getRelativeExpiryLabel('', 'US', fixedNow)).toBe('');
  });

  it('falls back to formatDate for invalid date strings', () => {
    expect(getRelativeExpiryLabel('not-a-valid-date', 'US', fixedNow)).toBe('');
  });
});
