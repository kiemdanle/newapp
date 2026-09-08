import { describe, it, expect } from '@jest/globals';
import { detectNaturalDate } from '../naturalDateParser';

describe('detectNaturalDate', () => {
  const refDate = new Date(2026, 8, 7); // September 7, 2026

  describe('Standard 2-digit and 4-digit separated formats', () => {
    it('parses 2-digit year with slashes in DMY (13/9/26)', () => {
      const res = detectNaturalDate('13/9/26', { countryCode: 'VN', referenceDate: refDate });
      expect(res).not.toBeNull();
      expect(res?.iso).toBe('2026-09-13');
      expect(res?.day).toBe(13);
      expect(res?.month).toBe(8); // 0-indexed September
      expect(res?.year).toBe(2026);
    });

    it('parses 2-digit year with hyphens (13-09-26)', () => {
      const res = detectNaturalDate('13-09-26', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses 2-digit year with dots (13.9.26)', () => {
      const res = detectNaturalDate('13.9.26', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses standard 4-digit ISO (2026-09-13)', () => {
      const res = detectNaturalDate('2026-09-13', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('expands 2-digit years >= 70 to 1900s and < 70 to 2000s', () => {
      const res2000 = detectNaturalDate('10/10/28', { countryCode: 'VN', referenceDate: refDate });
      expect(res2000?.year).toBe(2028);

      const res1999 = detectNaturalDate('10/10/99', { countryCode: 'VN', referenceDate: refDate });
      expect(res1999?.year).toBe(1999);
    });
  });

  describe('Day and Month only (year omitted)', () => {
    it('parses upcoming date in current year (13/9 when today is 7/9)', () => {
      const res = detectNaturalDate('13/9', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
      expect(res?.year).toBe(2026);
    });

    it('immediately rolls forward to next year if date has already passed (1/9 when today is 7/9)', () => {
      const res = detectNaturalDate('1/9', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2027-09-01');
      expect(res?.year).toBe(2027);
    });

    it('rolls forward to next year for past months (15/5 when today is in September)', () => {
      const res = detectNaturalDate('15/5', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2027-05-15');
      expect(res?.year).toBe(2027);
    });
  });

  describe('Textual English and Vietnamese months', () => {
    it('parses "Sep 13"', () => {
      const res = detectNaturalDate('Sep 13', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses "13 Sep"', () => {
      const res = detectNaturalDate('13 Sep', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses "September 13, 2026"', () => {
      const res = detectNaturalDate('September 13, 2026', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses Vietnamese "13 thg 9"', () => {
      const res = detectNaturalDate('13 thg 9', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses Vietnamese "13 thang 9"', () => {
      const res = detectNaturalDate('13 thang 9', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses Vietnamese with tone marks "13 tháng 9"', () => {
      const res = detectNaturalDate('13 tháng 9', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses "13 Th09"', () => {
      const res = detectNaturalDate('13 Th09', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });
  });

  describe('Compact unseparated digits', () => {
    it('parses 4 digits in DMY (1309 -> 13/09)', () => {
      const res = detectNaturalDate('1309', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses 6 digits DDMMYY (130926)', () => {
      const res = detectNaturalDate('130926', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses 8 digits YYYYMMDD (20260913)', () => {
      const res = detectNaturalDate('20260913', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });

    it('parses 8 digits DDMMYYYY (13092026)', () => {
      const res = detectNaturalDate('13092026', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-13');
    });
  });

  describe('Relative grocery shorthand', () => {
    it('parses "+3" and "+3d" to 3 days in future', () => {
      const res1 = detectNaturalDate('+3', { referenceDate: refDate });
      expect(res1?.iso).toBe('2026-09-10');

      const res2 = detectNaturalDate('3d', { referenceDate: refDate });
      expect(res2?.iso).toBe('2026-09-10');
    });

    it('parses "1w" and "+1w" to 7 days in future', () => {
      const res = detectNaturalDate('+1w', { referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-14');
    });

    it('parses "2w" to 14 days in future', () => {
      const res = detectNaturalDate('2w', { referenceDate: refDate });
      expect(res?.iso).toBe('2026-09-21');
    });

    it('parses "1m" and "3m" to 1 and 3 months in future', () => {
      const res1 = detectNaturalDate('1m', { referenceDate: refDate });
      expect(res1?.iso).toBe('2026-10-07');

      const res3 = detectNaturalDate('3m', { referenceDate: refDate });
      expect(res3?.iso).toBe('2026-12-07');
    });

    it('parses natural keywords "tomorrow" and "today"', () => {
      const resTomorrow = detectNaturalDate('tomorrow', { referenceDate: refDate });
      expect(resTomorrow?.iso).toBe('2026-09-08');

      const resToday = detectNaturalDate('today', { referenceDate: refDate });
      expect(resToday?.iso).toBe('2026-09-07');
    });
  });

  describe('Smart day/month disambiguation & locale priority', () => {
    it('uses DMY priority in VN for ambiguous values (05/06/2026 -> 5 June)', () => {
      const res = detectNaturalDate('05/06/2026', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-06-05');
    });

    it('uses MDY priority in US for ambiguous values (05/06/2026 -> May 6)', () => {
      const res = detectNaturalDate('05/06/2026', { countryCode: 'US', referenceDate: refDate });
      expect(res?.iso).toBe('2026-05-06');
    });

    it('auto-detects Day when a number is > 12 even in US format (13/05/2026)', () => {
      const res = detectNaturalDate('13/05/2026', { countryCode: 'US', referenceDate: refDate });
      expect(res?.iso).toBe('2026-05-13');
    });

    it('auto-detects Day when a number is > 12 even in DMY format (05/13/2026)', () => {
      const res = detectNaturalDate('05/13/2026', { countryCode: 'VN', referenceDate: refDate });
      expect(res?.iso).toBe('2026-05-13');
    });
  });

  describe('Calendar validation & error rejection', () => {
    it('validates leap years: accepts 29/02/2024 and rejects 29/02/2025', () => {
      const validLeap = detectNaturalDate('29/02/2024', { countryCode: 'VN', referenceDate: refDate });
      expect(validLeap?.iso).toBe('2024-02-29');

      const invalidLeap = detectNaturalDate('29/02/2025', { countryCode: 'VN', referenceDate: refDate });
      expect(invalidLeap).toBeNull();
    });

    it('rejects invalid day numbers (32/01/2026 or 31/04/2026)', () => {
      expect(detectNaturalDate('32/01/2026', { countryCode: 'VN' })).toBeNull();
      expect(detectNaturalDate('31/04/2026', { countryCode: 'VN' })).toBeNull();
    });

    it('returns null for empty strings or gibberish', () => {
      expect(detectNaturalDate('')).toBeNull();
      expect(detectNaturalDate('   ')).toBeNull();
      expect(detectNaturalDate('not-a-date')).toBeNull();
    });
  });
});
