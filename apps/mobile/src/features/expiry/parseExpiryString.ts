const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
};

function normYear(y: number): number {
  if (y < 100) return y < 50 ? 2000 + y : 1900 + y;
  return y;
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > dim) return null;
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

interface Match {
  iso: string;
  isExpiryMarker: boolean;
  // 2 = full date (explicit day); 1 = month-only (synthesized last-of-month).
  // A full date must outrank a month-only match for the same text so that e.g.
  // "15.06.2026" (June 15) beats the "06.2026" → June 30 month-only reading.
  precision: 1 | 2;
}

function pushIfValid(
  out: Match[],
  iso: string | null,
  isExpiryMarker: boolean,
  precision: 1 | 2,
): void {
  if (iso) out.push({ iso, isExpiryMarker, precision });
}

export function parseExpiryString(input: string): string | null {
  if (!input) return null;
  // Normalize spaces around separators
  const text = ' ' + input.toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const matches: Match[] = [];

  const expiryHints = /(exp|expir|best before|best-before|bb|use by)/;

  // 1. dd[sep]mm[sep]yyyy (or yy). Leading boundary so the dd group can't start
  //    mid-number (e.g. matching "26-12-31" inside "2026-12-31").
  for (const m of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})(?:[^\d]|$)/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = normYear(Number(m[3]));
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx), 2);
  }

  // 2. yyyy[sep]mm[sep]dd
  for (const m of text.matchAll(/(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/g)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx), 2);
  }

  // 3. dd <MonthName> yyyy
  for (const m of text.matchAll(/(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})/g)) {
    const mo = MONTHS[m[2]!];
    if (!mo) continue;
    const d = Number(m[1]);
    const y = normYear(Number(m[3]));
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx), 2);
  }

  // 4. mm[sep]yyyy (month/year, last day of month)
  for (const m of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[/\-.]\s*(\d{4})(?:[^\d]|$)/g)) {
    const mo = Number(m[1]);
    const y = Number(m[2]);
    if (mo < 1 || mo > 12) continue;
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, lastDay), expiryHints.test(ctx), 1);
  }

  // 5. mm/yy (month/year, last day of month)
  for (const m of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[/\-.]\s*(\d{2})(?:[^\d]|$)/g)) {
    const mo = Number(m[1]);
    const y = normYear(Number(m[2]));
    if (mo < 1 || mo > 12) continue;
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, lastDay), expiryHints.test(ctx), 1);
  }

  if (matches.length === 0) return null;

  // Selection order: expiry-hinted matches first, then higher precision (full
  // date over month-only), then the latest date as a final tiebreaker.
  const marked = matches.filter((m) => m.isExpiryMarker);
  const pool = marked.length > 0 ? marked : matches;
  pool.sort((a, b) => b.precision - a.precision || b.iso.localeCompare(a.iso));
  return pool[0]!.iso;
}
