import { parseExpiryString } from '../features/expiry/parseExpiryString';

const cases: Array<[string, string]> = [
  ['31/12/2026', '2026-12-31'],
  ['31-12-2026', '2026-12-31'],
  ['31.12.2026', '2026-12-31'],
  ['12/2026', '2026-12-31'],
  ['12-2026', '2026-12-31'],
  ['EXP 31 DEC 2026', '2026-12-31'],
  ['Best before 31 Dec 2026', '2026-12-31'],
  ['BB 31/12/26', '2026-12-31'],
  ['2026-12-31', '2026-12-31'],
  ['2026/12/31', '2026-12-31'],
  ['31 December 2026', '2026-12-31'],
  ['Exp: 12/26', '2026-12-31'],
  ['use by 01 Jan 2027', '2027-01-01'],
  ['MFG 01/01/26 EXP 01/01/27', '2027-01-01'], // picks the later (EXP/use-by) date
  ['best-before 15.06.2026', '2026-06-15'],
  ['  31 / 12 / 2026  ', '2026-12-31'],
];

describe('parseExpiryString', () => {
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} → ${expected}`, () => {
      expect(parseExpiryString(input)).toBe(expected);
    });
  }

  it('returns null for unparseable text', () => {
    expect(parseExpiryString('hello world')).toBeNull();
    expect(parseExpiryString('')).toBeNull();
    expect(parseExpiryString('99/99/9999')).toBeNull();
  });
});
