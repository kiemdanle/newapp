import {
  getCountryMetadata,
  getAllCountries,
  DEFAULT_COUNTRY_METADATA,
  type CountryMetadata,
} from '@expyrico/shared';

export { getCountryMetadata, getAllCountries, DEFAULT_COUNTRY_METADATA, type CountryMetadata };

export type DateFormatStyle = 'short' | 'medium' | 'relative';

function toDate(input: string | Date | number): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Deterministic date formatter adhering to country date patterns:
 * - DMY (e.g. VN, GB, FR, DE): DD/MM/YYYY or DD Mon YYYY
 * - MDY (e.g. US, PH): MM/DD/YYYY or Mon DD, YYYY
 * - YMD (e.g. JP, CA, KR, SE): YYYY/MM/DD or YYYY Mon DD
 */
export function formatDate(
  input: string | Date | number | null | undefined,
  countryCode?: string | null,
  options?: { style?: DateFormatStyle },
): string {
  if (!input) return '';
  const d = toDate(input);
  if (!d) return '';

  const meta = getCountryMetadata(countryCode);
  const style = options?.style ?? 'short';

  if (style === 'relative') {
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    // Fall through to short date if older than 7 days
  }

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const shortMonth = MONTH_NAMES_SHORT[d.getMonth()]!;

  if (style === 'medium') {
    switch (meta.dateFormat) {
      case 'DMY':
        return `${d.getDate()} ${shortMonth} ${year}`;
      case 'MDY':
        return `${shortMonth} ${d.getDate()}, ${year}`;
      case 'YMD':
        return `${year} ${shortMonth} ${d.getDate()}`;
    }
  }

  // Short style
  switch (meta.dateFormat) {
    case 'DMY':
      return `${day}/${month}/${year}`;
    case 'MDY':
      return `${month}/${day}/${year}`;
    case 'YMD':
      return `${year}/${month}/${day}`;
  }
}

/**
 * Deterministic time formatter adhering to 12h vs 24h conventions.
 */
export function formatTime(
  input: string | Date | number | null | undefined,
  countryCode?: string | null,
  options?: { showSeconds?: boolean },
): string {
  if (!input) return '';
  const d = toDate(input);
  if (!d) return '';

  const meta = getCountryMetadata(countryCode);
  const hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = options?.showSeconds ? `:${pad(d.getSeconds())}` : '';

  if (meta.is24Hour) {
    return `${pad(hours)}:${minutes}${seconds}`;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes}${seconds} ${period}`;
}

/**
 * Combines date and time into a readable localized string.
 */
export function formatDateTime(
  input: string | Date | number | null | undefined,
  countryCode?: string | null,
): string {
  if (!input) return '';
  const dateStr = formatDate(input, countryCode, { style: 'short' });
  const timeStr = formatTime(input, countryCode);
  return `${dateStr} ${timeStr}`.trim();
}

/**
 * Formats currency values with correct symbols, symbol positioning, and grouping.
 * Prioritizes explicit entity currency (`currencyOverride`) when provided.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyOverride?: string | null,
  countryCode?: string | null,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '$0.00';

  const meta = getCountryMetadata(countryCode);
  const currencyCode = currencyOverride ? currencyOverride.toUpperCase() : meta.currencyCode;

  // Currencies without fractional cents
  const zeroDecimalCurrencies = new Set(['VND', 'JPY', 'KRW', 'CLP', 'HUF', 'PYG', 'UGX']);
  const isZeroDecimal = zeroDecimalCurrencies.has(currencyCode);

  let formattedNumber: string;
  if (currencyCode === 'VND') {
    // 100.000 ₫
    formattedNumber = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedNumber} ₫`;
  }

  if (currencyCode === 'JPY') {
    formattedNumber = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `¥${formattedNumber}`;
  }

  if (currencyCode === 'EUR') {
    // 10,00 €
    const parts = (isZeroDecimal ? Math.round(amount).toString() : amount.toFixed(2)).split('.');
    const integerPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = parts[1] ? `,${parts[1]}` : (isZeroDecimal ? '' : ',00');
    return `${integerPart}${decimalPart} €`;
  }

  if (currencyCode === 'GBP') {
    const parts = (isZeroDecimal ? Math.round(amount).toString() : amount.toFixed(2)).split('.');
    const integerPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decimalPart = parts[1] ? `.${parts[1]}` : (isZeroDecimal ? '' : '.00');
    return `£${integerPart}${decimalPart}`;
  }

  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    CAD: '$',
    AUD: '$',
    NZD: '$',
    SGD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    VND: '₫',
    KRW: '₩',
    INR: '₹',
    THB: '฿',
    PHP: '₱',
  };
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? (currencyOverride && currencyOverride !== meta.currencyCode ? `${currencyCode} ` : meta.currencySymbol);
  const parts = (isZeroDecimal ? Math.round(amount).toString() : amount.toFixed(2)).split('.');
  const integerPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = parts[1] ? `.${parts[1]}` : (isZeroDecimal ? '' : '.00');

  return `${symbol}${integerPart}${decimalPart}`;
}

/**
 * Formats numbers with localized grouping separators.
 */
export function formatNumber(
  value: number | null | undefined,
  countryCode?: string | null,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const meta = getCountryMetadata(countryCode);
  const delimiter = meta.locale.startsWith('vi') || meta.locale.startsWith('de') || meta.locale.startsWith('fr') ? '.' : ',';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
}
