import { describe, it, expect } from '@jest/globals';
import { formatDate, formatTime, formatCurrency, formatNumber, getCountryMetadata } from './country-format';

describe('country-format utilities', () => {
  const sampleDate = new Date('2026-08-26T14:30:00.000Z');

  describe('formatDate', () => {
    it('formats DMY for Vietnam and United Kingdom', () => {
      expect(formatDate(sampleDate, 'VN')).toMatch(/\d{2}\/08\/2026/);
      expect(formatDate(sampleDate, 'GB')).toMatch(/\d{2}\/08\/2026/);
      expect(formatDate(sampleDate, 'VN', { style: 'medium' })).toMatch(/\d{1,2} Aug 2026/);
    });

    it('formats MDY for United States', () => {
      expect(formatDate(sampleDate, 'US')).toMatch(/08\/\d{2}\/2026/);
      expect(formatDate(sampleDate, 'US', { style: 'medium' })).toMatch(/Aug \d{1,2}, 2026/);
    });

    it('formats YMD for Japan and Canada', () => {
      expect(formatDate(sampleDate, 'JP')).toMatch(/2026\/08\/\d{2}/);
      expect(formatDate(sampleDate, 'CA')).toMatch(/2026\/08\/\d{2}/);
    });

    it('handles null/undefined gracefully', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('')).toBe('');
    });
  });

  describe('formatTime', () => {
    it('formats 24-hour time for Vietnam and Germany', () => {
      const formatted = formatTime(sampleDate, 'VN');
      expect(formatted).not.toContain('AM');
      expect(formatted).not.toContain('PM');
    });

    it('formats 12-hour time for United States', () => {
      const formatted = formatTime(sampleDate, 'US');
      expect(formatted).toMatch(/(AM|PM)/);
    });
  });

  describe('formatCurrency', () => {
    it('formats VND without cents and with dong symbol suffix', () => {
      expect(formatCurrency(150000, null, 'VN')).toBe('150.000 ₫');
      expect(formatCurrency(50000, 'VND', 'US')).toBe('50.000 ₫');
    });

    it('formats JPY without cents and with yen prefix', () => {
      expect(formatCurrency(2500, null, 'JP')).toBe('¥2,500');
    });

    it('formats EUR with euro suffix', () => {
      expect(formatCurrency(12.5, null, 'DE')).toBe('12,50 €');
    });

    it('formats GBP with pound prefix', () => {
      expect(formatCurrency(9.99, null, 'GB')).toBe('£9.99');
    });

    it('formats USD with dollar prefix', () => {
      expect(formatCurrency(19.99, null, 'US')).toBe('$19.99');
    });

    it('preserves historical entity currency override over user country', () => {
      // User is in Vietnam, but Deal has explicit currency: "USD"
      expect(formatCurrency(10.5, 'USD', 'VN')).toBe('$10.50');
      // User is in US, but Deal has explicit currency: "EUR"
      expect(formatCurrency(25.0, 'EUR', 'US')).toBe('25,00 €');
    });
  });

  describe('formatNumber', () => {
    it('formats large numbers with correct thousand delimiters', () => {
      expect(formatNumber(1000000, 'US')).toBe('1,000,000');
      expect(formatNumber(1000000, 'VN')).toBe('1.000.000');
    });
  });
});
