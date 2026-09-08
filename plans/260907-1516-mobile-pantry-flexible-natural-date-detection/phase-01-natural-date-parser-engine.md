---
phase: 1
title: "Robust Multi-Pattern Natural Date Detection Engine"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Robust Multi-Pattern Natural Date Detection Engine
<!-- Updated: Validation Session 1 - Smart roll-forward, country-driven >12 auto-detect, comprehensive Vietnamese tokens -->

## Overview
Implement a resilient, zero-dependency natural date detection engine (`naturalDateParser.ts`) that extracts accurate expiration dates from arbitrary user typing (e.g. `13/9/26`, `Sep 13`, `13 thg 9`, `+3d`, `1w`, `130926`) while respecting locale conventions (Vietnam `DMY` vs US `MDY`) with intelligent month/day disambiguation.

## Requirements
- Functional:
  - Export `detectNaturalDate(input: string, options?: { countryCode?: string | null; referenceDate?: Date }): ParsedDateResult | null`:
    - Returns `{ year: number; month: number; day: number; iso: string; formatted: string } | null`
  - Pattern 1: **2-Digit & 4-Digit Standard Separators** (`/`, `-`, `.`, spaces):
    - `13/9/26`, `13-9-26`, `13.9.26`, `13 9 26` $\rightarrow$ `2026-09-13`
    - `2026-09-13`, `2026/09/13` (ISO / YMD)
    - Century expansion: 2-digit years `00-69` expand to `2000-2069`; `70-99` expand to `1970-1999`.
  - Pattern 2: **Day & Month Only** (omitted year):
    - `13/9` or `13-09`: defaults year to current year (`2026`). If the resulting date has already passed relative to today, rolls forward to next year (`2027`).
  - Pattern 3: **Textual Month Names (English & Vietnamese)**:
    - English: `Sep 13`, `13 Sep`, `September 13`, `13 September`, `13-Sep-26`, `Sep 13 2026`
    - Vietnamese: `13 thg 9`, `13 thang 9`, `Thg 9 13`, `13 Th09`, `13/Thg 9/2026`
    - Case-insensitive, ignores extra commas or periods (`Sep. 13, 2026`).
  - Pattern 4: **Compact Unseparated Digits**:
    - 4 digits: `1309` $\rightarrow$ Day 13, Month 9, current year
    - 6 digits: `130926` $\rightarrow$ Day 13, Month 9, Year 2026 (or `260913` YYMMDD)
    - 8 digits: `13092026` (DDMMYYYY), `09132026` (MMDDYYYY), `20260913` (YYYYMMDD)
  - Pattern 5: **Relative Grocery Shorthand**:
    - `+3`, `+3d`, `3d`, `3 days` $\rightarrow$ today + 3 days
    - `1w`, `+1w`, `1 week`, `2w`, `+2w` $\rightarrow$ today + 7 / 14 days
    - `1m`, `+1m`, `1 month`, `3m`, `+3m` $\rightarrow$ today + 1 / 3 months
    - Natural words: `today`, `tomorrow`, `next week`, `next month`
  - Pattern 6: **Locale Disambiguation with Smart Fallback**:
    - If `countryCode` is `VN` (or any `DMY` country): parses `A/B` as `Day A, Month B`.
    - If `countryCode` is `US` (or any `MDY` country): parses `A/B` as `Month A, Day B`.
    - **Smart $> 12$ Rule**: If either number is $> 12$ and $\le 31$, that number is guaranteed to be the Day regardless of locale setting (e.g. `9/13` or `13/9` both recognize 13 as Day and 9 as Month).
  - Validation:
    - Rejects impossible days (e.g. Feb 30, April 31).
    - Correctly calculates leap year days for February (e.g. Feb 29 on 2024 / 2028).
- Non-functional:
  - Pure TypeScript, zero external npm dependencies, execution $< 1\text{ms}$.
  - Resilient to trailing whitespace, multiple spaces, mixed casing.

## Architecture
```
User Free-form Input
       │
       ▼
[normalizeInput] ──> strip extra spaces, lower-case, remove trailing dots/commas
       │
       ├──> [Relative Offset Matcher] (+3, 1w, 2w, 1m, 3m, tomorrow)
       │    └── returns computed target date
       │
       ├──> [Textual Month Matcher] (Sep 13, 13 Sep, 13 thg 9, September 13)
       │    └── maps month token -> month index (0-11) -> parses day & year
       │
       ├──> [Delimited Numeric Matcher] (13/9/26, 13-09-2026, 13.9.26, 13/9)
       │    └── applies country locale (DMY vs MDY) + Smart >12 day disambiguation
       │
       ├──> [Compact Digits Matcher] (130926, 13092026, 20260913, 1309)
       │    └── splits into parts based on digit length and locale
       │
       ▼
[validateAndConstructResult]
       ├── checks month 0-11, day 1-daysInMonth(year, month)
       ├── generates ISO: YYYY-MM-DD
       └── generates formatted: formatDate(d, countryCode, { style: 'medium' })
```

## Related Code Files
- Create: `apps/mobile/src/utils/naturalDateParser.ts`
- Create: `apps/mobile/src/utils/__tests__/naturalDateParser.test.ts`
- Modify: `apps/mobile/src/utils/country-format.ts`

## Implementation Steps
1. Create `apps/mobile/src/utils/naturalDateParser.ts`:
   - Implement normalization, relative offset dictionary (`d`, `w`, `m`, `y`), English month dictionary, and Vietnamese month tokens (`thang`, `thg`, `th01`-`th12`).
   - Implement delimited parsing with locale priority (`DMY` vs `MDY`) and smart day range bounds checking.
   - Implement compact digit parsing for 4, 6, and 8 digits.
   - Implement leap-year aware day validation.
2. Unit tests in `naturalDateParser.test.ts`:
   - Test all permutations: `13/9/26`, `Sep 13`, `13 Sep`, `13 thg 9`, `+3d`, `1w`, `2026-09-13`, `130926`, invalid dates (`32/01`, `29/02/2025`).

## Success Criteria
- [x] `13/9/26` correctly parses to `2026-09-13`.
- [x] `Sep 13` and `13 Sep` parse to September 13 of current year.
- [x] `13 thg 9` and `13 thang 9` parse to September 13.
- [x] `+3d`, `1w`, `2w`, `1m`, `3m` compute exact future dates.
- [x] Compact digits like `130926` parse correctly.
- [x] Invalid inputs return `null` without throwing exceptions.

## Risk Assessment
- Risk: Ambiguous dates like `05/06/2026` where both day and month are $\le 12$.
  - Mitigation: Use the user's active country setting (`countryCode`). For Vietnam (`VN`), it prioritizes DMY (June 5). For US, MDY (May 6). If one value $> 12$ (e.g. `13/05/2026`), smart disambiguation automatically assigns the $> 12$ value to Day.
