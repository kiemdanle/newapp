import type { LocalRecord } from '../../api/records';

export interface GroupedRecords {
  expired: LocalRecord[];
  today: LocalRecord[];
  thisWeek: LocalRecord[];
  later: LocalRecord[];
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function groupRecords(rows: LocalRecord[], now: Date = new Date()): GroupedRecords {
  const today = startOfDayUtc(now);
  const oneDay = 24 * 60 * 60 * 1000;
  const weekEnd = new Date(today.getTime() + 7 * oneDay);

  const groups: GroupedRecords = { expired: [], today: [], thisWeek: [], later: [] };

  for (const r of rows) {
    const exp = startOfDayUtc(new Date(`${r.expiryDate}T00:00:00Z`));
    if (exp.getTime() < today.getTime()) groups.expired.push(r);
    else if (exp.getTime() === today.getTime()) groups.today.push(r);
    else if (exp.getTime() <= weekEnd.getTime()) groups.thisWeek.push(r);
    else groups.later.push(r);
  }

  const byExp = (a: LocalRecord, b: LocalRecord) => a.expiryDate.localeCompare(b.expiryDate);
  groups.expired.sort(byExp);
  groups.today.sort(byExp);
  groups.thisWeek.sort(byExp);
  groups.later.sort(byExp);
  return groups;
}
