import { z } from 'zod';

export const countryMetadataSchema = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  flag: z.string().min(1),
  locale: z.string().min(2),
  currencyCode: z.string().length(3),
  currencySymbol: z.string().min(1),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']),
  is24Hour: z.boolean(),
});
export type CountryMetadata = z.infer<typeof countryMetadataSchema>;

/**
 * Lightweight, zero-dependency registry of common countries with regional
 * conventions (locale, currency, date format, clock).
 */
export const RECORD_COUNTRIES: Record<string, CountryMetadata> = {
  US: { code: 'US', name: 'United States', flag: '🇺🇸', locale: 'en-US', currencyCode: 'USD', currencySymbol: '$', dateFormat: 'MDY', is24Hour: false },
  VN: { code: 'VN', name: 'Vietnam', flag: '🇻🇳', locale: 'vi-VN', currencyCode: 'VND', currencySymbol: '₫', dateFormat: 'DMY', is24Hour: true },
  GB: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', locale: 'en-GB', currencyCode: 'GBP', currencySymbol: '£', dateFormat: 'DMY', is24Hour: true },
  CA: { code: 'CA', name: 'Canada', flag: '🇨🇦', locale: 'en-CA', currencyCode: 'CAD', currencySymbol: '$', dateFormat: 'YMD', is24Hour: false },
  AU: { code: 'AU', name: 'Australia', flag: '🇦🇺', locale: 'en-AU', currencyCode: 'AUD', currencySymbol: '$', dateFormat: 'DMY', is24Hour: false },
  DE: { code: 'DE', name: 'Germany', flag: '🇩🇪', locale: 'de-DE', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  FR: { code: 'FR', name: 'France', flag: '🇫🇷', locale: 'fr-FR', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  JP: { code: 'JP', name: 'Japan', flag: '🇯🇵', locale: 'ja-JP', currencyCode: 'JPY', currencySymbol: '¥', dateFormat: 'YMD', is24Hour: true },
  SG: { code: 'SG', name: 'Singapore', flag: '🇸🇬', locale: 'en-SG', currencyCode: 'SGD', currencySymbol: '$', dateFormat: 'DMY', is24Hour: true },
  KR: { code: 'KR', name: 'South Korea', flag: '🇰🇷', locale: 'ko-KR', currencyCode: 'KRW', currencySymbol: '₩', dateFormat: 'YMD', is24Hour: true },
  IN: { code: 'IN', name: 'India', flag: '🇮🇳', locale: 'en-IN', currencyCode: 'INR', currencySymbol: '₹', dateFormat: 'DMY', is24Hour: false },
  TH: { code: 'TH', name: 'Thailand', flag: '🇹🇭', locale: 'th-TH', currencyCode: 'THB', currencySymbol: '฿', dateFormat: 'DMY', is24Hour: true },
  ID: { code: 'ID', name: 'Indonesia', flag: '🇮🇩', locale: 'id-ID', currencyCode: 'IDR', currencySymbol: 'Rp', dateFormat: 'DMY', is24Hour: true },
  MY: { code: 'MY', name: 'Malaysia', flag: '🇲🇾', locale: 'ms-MY', currencyCode: 'MYR', currencySymbol: 'RM', dateFormat: 'DMY', is24Hour: true },
  PH: { code: 'PH', name: 'Philippines', flag: '🇵🇭', locale: 'en-PH', currencyCode: 'PHP', currencySymbol: '₱', dateFormat: 'MDY', is24Hour: false },
  NZ: { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', locale: 'en-NZ', currencyCode: 'NZD', currencySymbol: '$', dateFormat: 'DMY', is24Hour: false },
  NL: { code: 'NL', name: 'Netherlands', flag: '🇳🇱', locale: 'nl-NL', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  ES: { code: 'ES', name: 'Spain', flag: '🇪🇸', locale: 'es-ES', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  IT: { code: 'IT', name: 'Italy', flag: '🇮🇹', locale: 'it-IT', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  SE: { code: 'SE', name: 'Sweden', flag: '🇸🇪', locale: 'sv-SE', currencyCode: 'SEK', currencySymbol: 'kr', dateFormat: 'YMD', is24Hour: true },
  NO: { code: 'NO', name: 'Norway', flag: '🇳🇴', locale: 'nb-NO', currencyCode: 'NOK', currencySymbol: 'kr', dateFormat: 'DMY', is24Hour: true },
  DK: { code: 'DK', name: 'Denmark', flag: '🇩🇰', locale: 'da-DK', currencyCode: 'DKK', currencySymbol: 'kr', dateFormat: 'DMY', is24Hour: true },
  FI: { code: 'FI', name: 'Finland', flag: '🇫🇮', locale: 'fi-FI', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  CH: { code: 'CH', name: 'Switzerland', flag: '🇨🇭', locale: 'de-CH', currencyCode: 'CHF', currencySymbol: 'CHF', dateFormat: 'DMY', is24Hour: true },
  IE: { code: 'IE', name: 'Ireland', flag: '🇮🇪', locale: 'en-IE', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  PL: { code: 'PL', name: 'Poland', flag: '🇵🇱', locale: 'pl-PL', currencyCode: 'PLN', currencySymbol: 'zł', dateFormat: 'DMY', is24Hour: true },
  BE: { code: 'BE', name: 'Belgium', flag: '🇧🇪', locale: 'nl-BE', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  AT: { code: 'AT', name: 'Austria', flag: '🇦🇹', locale: 'de-AT', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  PT: { code: 'PT', name: 'Portugal', flag: '🇵🇹', locale: 'pt-PT', currencyCode: 'EUR', currencySymbol: '€', dateFormat: 'DMY', is24Hour: true },
  BR: { code: 'BR', name: 'Brazil', flag: '🇧🇷', locale: 'pt-BR', currencyCode: 'BRL', currencySymbol: 'R$', dateFormat: 'DMY', is24Hour: true },
  MX: { code: 'MX', name: 'Mexico', flag: '🇲🇽', locale: 'es-MX', currencyCode: 'MXN', currencySymbol: '$', dateFormat: 'DMY', is24Hour: false },
  AR: { code: 'AR', name: 'Argentina', flag: '🇦🇷', locale: 'es-AR', currencyCode: 'ARS', currencySymbol: '$', dateFormat: 'DMY', is24Hour: true },
  ZA: { code: 'ZA', name: 'South Africa', flag: '🇿🇦', locale: 'en-ZA', currencyCode: 'ZAR', currencySymbol: 'R', dateFormat: 'YMD', is24Hour: true },
  AE: { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', locale: 'en-AE', currencyCode: 'AED', currencySymbol: 'AED', dateFormat: 'DMY', is24Hour: true },
  SA: { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', locale: 'ar-SA', currencyCode: 'SAR', currencySymbol: 'SAR', dateFormat: 'DMY', is24Hour: true },
  IL: { code: 'IL', name: 'Israel', flag: '🇮🇱', locale: 'he-IL', currencyCode: 'ILS', currencySymbol: '₪', dateFormat: 'DMY', is24Hour: true },
};

export const DEFAULT_COUNTRY_METADATA: CountryMetadata = RECORD_COUNTRIES.US!;

export function getCountryMetadata(countryCode: string | null | undefined): CountryMetadata {
  if (!countryCode) return DEFAULT_COUNTRY_METADATA;
  const upper = countryCode.toUpperCase();
  if (upper in RECORD_COUNTRIES) {
    return RECORD_COUNTRIES[upper]!;
  }
  // Generic fallback using Intl defaults if available
  return {
    code: upper,
    name: upper,
    flag: '🌐',
    locale: 'en',
    currencyCode: 'USD',
    currencySymbol: '$',
    dateFormat: 'MDY',
    is24Hour: false,
  };
}

export function getAllCountries(): CountryMetadata[] {
  return Object.values(RECORD_COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
}
