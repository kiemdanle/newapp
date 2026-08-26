import { useMemo } from 'react';
import { useSessionStore } from '../auth/session-store';
import {
  getCountryMetadata,
  formatDate as formatWithCountry,
  formatTime as formatTimeWithCountry,
  formatDateTime as formatDateTimeWithCountry,
  formatCurrency as formatCurrencyWithCountry,
  formatNumber as formatNumberWithCountry,
  type DateFormatStyle,
  type CountryMetadata,
} from '../utils/country-format';

export function useCountryFormat() {
  const userCountry = useSessionStore((s) => s.user?.country);

  const countryMetadata: CountryMetadata = useMemo(
    () => getCountryMetadata(userCountry),
    [userCountry],
  );

  return useMemo(
    () => ({
      activeCountry: countryMetadata.code,
      countryMetadata,
      currencyCode: countryMetadata.currencyCode,
      currencySymbol: countryMetadata.currencySymbol,
      dateFormat: countryMetadata.dateFormat,
      formatDate: (input: string | Date | number | null | undefined, options?: { style?: DateFormatStyle }) =>
        formatWithCountry(input, userCountry, options),
      formatTime: (input: string | Date | number | null | undefined, options?: { showSeconds?: boolean }) =>
        formatTimeWithCountry(input, userCountry, options),
      formatDateTime: (input: string | Date | number | null | undefined) =>
        formatDateTimeWithCountry(input, userCountry),
      formatCurrency: (amount: number | null | undefined, currencyOverride?: string | null) =>
        formatCurrencyWithCountry(amount, currencyOverride, userCountry),
      formatNumber: (value: number | null | undefined) =>
        formatNumberWithCountry(value, userCountry),
    }),
    [userCountry, countryMetadata],
  );
}
