export interface ParsedDateResult {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  day: number;   // 1-31
  iso: string;   // YYYY-MM-DD
}

export interface ParseDateOptions {
  countryCode?: string | null;
  referenceDate?: Date;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function getDaysInMonth(year: number, monthZero: number): number {
  return new Date(year, monthZero + 1, 0).getDate();
}

/**
 * Strips Vietnamese diacritics/tone marks for normalized token matching.
 */
function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const MONTH_MAP: Record<string, number> = {
  // English full & short
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,

  // Vietnamese variations (diacritics stripped)
  'thang 1': 0,
  'thang 01': 0,
  'thg 1': 0,
  'thg 01': 0,
  th01: 0,
  th1: 0,

  'thang 2': 1,
  'thang 02': 1,
  'thg 2': 1,
  'thg 02': 1,
  th02: 1,
  th2: 1,

  'thang 3': 2,
  'thang 03': 2,
  'thg 3': 2,
  'thg 03': 2,
  th03: 2,
  th3: 2,

  'thang 4': 3,
  'thang 04': 3,
  'thg 4': 3,
  'thg 04': 3,
  th04: 3,
  th4: 3,

  'thang 5': 4,
  'thang 05': 4,
  'thg 5': 4,
  'thg 05': 4,
  th05: 4,
  th5: 4,

  'thang 6': 5,
  'thang 06': 5,
  'thg 6': 5,
  'thg 06': 5,
  th06: 5,
  th6: 5,

  'thang 7': 6,
  'thang 07': 6,
  'thg 7': 6,
  'thg 07': 6,
  th07: 6,
  th7: 6,

  'thang 8': 7,
  'thang 08': 7,
  'thg 8': 7,
  'thg 08': 7,
  th08: 7,
  th8: 7,

  'thang 9': 8,
  'thang 09': 8,
  'thg 9': 8,
  'thg 09': 8,
  th09: 8,
  th9: 8,

  'thang 10': 9,
  'thg 10': 9,
  th10: 9,

  'thang 11': 10,
  'thg 11': 10,
  th11: 10,

  'thang 12': 11,
  'thg 12': 11,
  th12: 11,
};

function expandTwoDigitYear(yy: number): number {
  if (yy >= 0 && yy <= 69) return 2000 + yy;
  if (yy >= 70 && yy <= 99) return 1900 + yy;
  return yy;
}

function constructResult(year: number, month: number, day: number): ParsedDateResult | null {
  if (month < 0 || month > 11) return null;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;
  return {
    year,
    month,
    day,
    iso: `${year}-${pad2(month + 1)}-${pad2(day)}`,
  };
}

/**
 * Detects natural date expressions typed by users in arbitrary formats.
 *
 * Supported formats:
 * - 2-digit years: 13/9/26, 13-9-26, 26/9/13, 13.9.26
 * - Day & month only: 13/9, 13-09 (rolls forward if date has already passed)
 * - Textual months: Sep 13, 13 Sep, September 13, 13 thg 9, 13 thang 9
 * - Compact digits: 130926, 13092026, 20260913
 * - Relative shorthand: +3, +3d, 1w, 2w, 1m, 3m, tomorrow, today
 * - Locale disambiguation: VN -> DMY, US -> MDY, with smart > 12 day detection
 */
export function detectNaturalDate(
  raw: string,
  options?: ParseDateOptions,
): ParsedDateResult | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ref = options?.referenceDate ?? new Date();
  const refYear = ref.getFullYear();
  const todayUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

  const countryUpper = (options?.countryCode ?? 'VN').toUpperCase();
  const isMdy = countryUpper === 'US' || countryUpper === 'PH';

  const normalized = removeVietnameseDiacritics(trimmed.toLowerCase());

  // 1. Relative shorthand: +3, +3d, 3d, 1w, 2w, 1m, 3m, today, tomorrow, next week, next month
  // Requires explicit '+' or an explicit time unit to avoid capturing compact dates like 1309 or 130926
  if (/^(\+\d+\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)?|\d+\s*(d|day|days|w|week|weeks|m|month|months|y|year|years))$/i.test(normalized)) {
    const match = /^(\+)?(\d+)\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)?$/i.exec(normalized);
    if (match) {
      const count = Number(match[2]);
      const unit = (match[3] ?? 'd').toLowerCase();
      const target = new Date(ref);

      if (unit.startsWith('d')) {
        target.setDate(target.getDate() + count);
      } else if (unit.startsWith('w')) {
        target.setDate(target.getDate() + count * 7);
      } else if (unit.startsWith('m')) {
        target.setMonth(target.getMonth() + count);
      } else if (unit.startsWith('y')) {
        target.setFullYear(target.getFullYear() + count);
      }
      return constructResult(target.getFullYear(), target.getMonth(), target.getDate());
    }
  }

  if (normalized === 'today' || normalized === 'hom nay') {
    return constructResult(ref.getFullYear(), ref.getMonth(), ref.getDate());
  }
  if (normalized === 'tomorrow' || normalized === 'ngay mai') {
    const target = new Date(ref);
    target.setDate(target.getDate() + 1);
    return constructResult(target.getFullYear(), target.getMonth(), target.getDate());
  }
  if (normalized === 'next week' || normalized === 'tuan sau') {
    const target = new Date(ref);
    target.setDate(target.getDate() + 7);
    return constructResult(target.getFullYear(), target.getMonth(), target.getDate());
  }
  if (normalized === 'next month' || normalized === 'thang sau') {
    const target = new Date(ref);
    target.setMonth(target.getMonth() + 1);
    return constructResult(target.getFullYear(), target.getMonth(), target.getDate());
  }

  // 2. Textual month names (English and Vietnamese)
  // Clean punctuation: replace commas and dots with spaces
  const textClean = normalized.replace(/[,.]/g, ' ').replace(/\s+/g, ' ');

  for (const [token, monthIdx] of Object.entries(MONTH_MAP)) {
    if (textClean.includes(token)) {
      // Extract numbers around the token
      const withoutToken = textClean.replace(token, ' ').trim();
      const numbers = withoutToken.match(/\d+/g)?.map(Number);
      if (numbers && numbers.length > 0) {
        let day: number;
        let year: number;

        if (numbers.length === 1) {
          day = numbers[0]!;
          year = refYear;
          // Roll-forward: if date in current year has already passed relative to today, use next year
          if (Date.UTC(year, monthIdx, day) < todayUtc) {
            year += 1;
          }
        } else {
          // If 2 numbers, first is usually day and second is year (or vice versa if 4 digits)
          if (numbers[0]! > 31) {
            year = numbers[0]!;
            day = numbers[1]!;
          } else {
            day = numbers[0]!;
            year = numbers[1]!;
          }
          if (year < 100) {
            year = expandTwoDigitYear(year);
          }
        }
        return constructResult(year, monthIdx, day);
      }
    }
  }

  // 3. Delimited numeric expressions (using /, -, ., or spaces)
  const cleanDelimited = trimmed.replace(/[\s./]+/g, '-');
  const parts = cleanDelimited.split('-').filter(Boolean).map(Number);

  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) {
    let year: number;
    let monthZero: number;
    let day: number;

    const [p1, p2, p3] = parts as [number, number, number];

    // Case 3a: ISO format YYYY-MM-DD
    if (p1 > 31) {
      year = p1;
      monthZero = p2 - 1;
      day = p3;
    } else if (p3 > 31 || (p3 >= 0 && p3 < 100)) {
      // Case 3b: Date ends with year (2-digit or 4-digit)
      year = p3 < 100 ? expandTwoDigitYear(p3) : p3;

      if (isMdy) {
        monthZero = p1 - 1;
        day = p2;
      } else {
        day = p1;
        monthZero = p2 - 1;
      }

      // Smart >12 day disambiguation
      if (p2 > 12 && p1 <= 12) {
        day = p2;
        monthZero = p1 - 1;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        monthZero = p2 - 1;
      }
    } else if (p1 < 100 && p2 <= 12 && p3 <= 31 && !isMdy) {
      // YY-MM-DD
      year = expandTwoDigitYear(p1);
      monthZero = p2 - 1;
      day = p3;
    } else {
      return null;
    }

    return constructResult(year, monthZero, day);
  }

  // Case 3c: 2 numbers (Day and Month only, year omitted)
  if (parts.length === 2 && parts.every((p) => Number.isFinite(p))) {
    const [p1, p2] = parts as [number, number];
    let monthZero: number;
    let day: number;

    if (isMdy) {
      monthZero = p1 - 1;
      day = p2;
    } else {
      day = p1;
      monthZero = p2 - 1;
    }

    // Smart >12 day disambiguation
    if (p2 > 12 && p1 <= 12) {
      day = p2;
      monthZero = p1 - 1;
    } else if (p1 > 12 && p2 <= 12) {
      day = p1;
      monthZero = p2 - 1;
    }

    let year = refYear;
    // Immediate roll forward if date has already passed relative to today
    if (Date.UTC(year, monthZero, day) < todayUtc) {
      year += 1;
    }

    return constructResult(year, monthZero, day);
  }

  // 4. Compact unseparated digits
  if (/^\d{4,8}$/.test(trimmed)) {
    const digits = trimmed;
    // 4 digits: e.g. 1309 -> Day 13, Month 09
    if (digits.length === 4) {
      const p1 = Number(digits.slice(0, 2));
      const p2 = Number(digits.slice(2, 4));
      let day = isMdy ? p2 : p1;
      let monthZero = (isMdy ? p1 : p2) - 1;

      if (p2 > 12 && p1 <= 12) {
        day = p2;
        monthZero = p1 - 1;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        monthZero = p2 - 1;
      }

      let year = refYear;
      if (Date.UTC(year, monthZero, day) < todayUtc) {
        year += 1;
      }
      return constructResult(year, monthZero, day);
    }

    // 6 digits: e.g. 130926 (DDMMYY) or 260913 (YYMMDD)
    if (digits.length === 6) {
      const p1 = Number(digits.slice(0, 2));
      const p2 = Number(digits.slice(2, 4));
      const p3 = Number(digits.slice(4, 6));

      // Check YMD: 260913
      if (p1 > 20 && p2 <= 12 && p3 <= 31) {
        return constructResult(expandTwoDigitYear(p1), p2 - 1, p3);
      }

      // DMY or MDY with 2-digit year at end
      let day = isMdy ? p2 : p1;
      let monthZero = (isMdy ? p1 : p2) - 1;
      if (p2 > 12 && p1 <= 12) {
        day = p2;
        monthZero = p1 - 1;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        monthZero = p2 - 1;
      }
      return constructResult(expandTwoDigitYear(p3), monthZero, day);
    }

    // 8 digits: e.g. 20260913 (YYYYMMDD) or 13092026 (DDMMYYYY)
    if (digits.length === 8) {
      // YYYYMMDD
      if (digits.startsWith('20') || digits.startsWith('19')) {
        const y = Number(digits.slice(0, 4));
        const m = Number(digits.slice(4, 6)) - 1;
        const d = Number(digits.slice(6, 8));
        const res = constructResult(y, m, d);
        if (res) return res;
      }

      // DDMMYYYY or MMDDYYYY
      const p1 = Number(digits.slice(0, 2));
      const p2 = Number(digits.slice(2, 4));
      const y = Number(digits.slice(4, 8));

      let day = isMdy ? p2 : p1;
      let monthZero = (isMdy ? p1 : p2) - 1;
      if (p2 > 12 && p1 <= 12) {
        day = p2;
        monthZero = p1 - 1;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        monthZero = p2 - 1;
      }
      return constructResult(y, monthZero, day);
    }
  }

  return null;
}
