import { expiryStatus } from '../features/records/expiryStatus';

const now = new Date('2026-05-24T12:00:00Z');

describe('expiryStatus (default threshold 7)', () => {
  it('red when already expired', () => {
    expect(expiryStatus('2026-05-20', now)).toBe('red');
  });
  it('red when expires today', () => {
    expect(expiryStatus('2026-05-24', now)).toBe('red');
  });
  it('amber when 1 day out', () => {
    expect(expiryStatus('2026-05-25', now)).toBe('amber');
  });
  it('amber when exactly 7 days out', () => {
    expect(expiryStatus('2026-05-31', now)).toBe('amber');
  });
  it('green when 8 days out', () => {
    expect(expiryStatus('2026-06-01', now)).toBe('green');
  });
  it('honors a custom threshold of 3', () => {
    expect(expiryStatus('2026-05-27', now, 3)).toBe('amber');
    expect(expiryStatus('2026-05-28', now, 3)).toBe('green');
  });
});
