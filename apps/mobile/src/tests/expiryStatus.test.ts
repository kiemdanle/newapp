import { expiryStatus, getExpiryStatusBadgeStyles } from '../features/records/expiryStatus';
import { themes } from '@expyrico/theme';

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

describe('getExpiryStatusBadgeStyles', () => {
  it('returns high contrast dark mode styling for red status derived from danger token', () => {
    const style = getExpiryStatusBadgeStyles('red', themes.expyricoDark);
    expect(style.bg).toBe(themes.expyricoDark.colors.danger + '26');
    expect(style.border).toBe(themes.expyricoDark.colors.danger + '66');
    expect(style.dot).toBe(themes.expyricoDark.colors.danger);
    expect(style.textColor).toBe(themes.expyricoDark.colors.text);
  });

  it('returns high contrast dark mode styling for amber status derived from warning token', () => {
    const style = getExpiryStatusBadgeStyles('amber', themes.expyricoDark);
    expect(style.bg).toBe(themes.expyricoDark.colors.warning + '26');
    expect(style.border).toBe(themes.expyricoDark.colors.warning + '66');
    expect(style.dot).toBe(themes.expyricoDark.colors.warning);
    expect(style.textColor).toBe(themes.expyricoDark.colors.text);
  });

  it('returns high contrast dark mode styling for green status derived from primaryLight', () => {
    const style = getExpiryStatusBadgeStyles('green', themes.expyricoDark);
    expect(style.bg).toBe(themes.expyricoDark.colors.primaryLight);
    expect(style.border).toBe(themes.expyricoDark.colors.success + '50');
    expect(style.dot).toBe(themes.expyricoDark.colors.success);
    expect(style.textColor).toBe(themes.expyricoDark.colors.text);
  });

  it('preserves documented Soft Butter (accentLight) for amber in light mode', () => {
    const style = getExpiryStatusBadgeStyles('amber', themes.expyrico);
    expect(style.bg).toBe(themes.expyrico.colors.accentLight);
    expect(style.border).toBe(themes.expyrico.colors.warning + '4D');
    expect(style.dot).toBe(themes.expyrico.colors.warning);
    expect(style.textColor).toBe(themes.expyrico.colors.text);
  });

  it('preserves documented Mint Mist (primaryLight) and high-contrast text for green in light mode', () => {
    const style = getExpiryStatusBadgeStyles('green', themes.expyrico);
    expect(style.bg).toBe(themes.expyrico.colors.primaryLight);
    expect(style.border).toBe(themes.expyrico.colors.success + '33');
    expect(style.dot).toBe(themes.expyrico.colors.success);
    expect(style.textColor).toBe(themes.expyrico.colors.text);
  });

  it('returns calibrated light mode styling for red status', () => {
    const style = getExpiryStatusBadgeStyles('red', themes.expyrico);
    expect(style.bg).toBe(themes.expyrico.colors.danger + '14');
    expect(style.border).toBe(themes.expyrico.colors.danger + '3D');
    expect(style.dot).toBe(themes.expyrico.colors.danger);
    expect(style.textColor).toBe(themes.expyrico.colors.text);
  });
});
