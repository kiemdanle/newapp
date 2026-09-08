---
title: "Mobile Pantry Flexible Natural Date Detection (13/9/26, Sep 13, 13 thg 9, Shorthand)"
description: "Implement a resilient multi-pattern natural date detection engine allowing users to type expiry dates however they like (13/9/26, Sep 13, 13 thg 9, +1w, 130926) with real-time wheel synchronization and live visual feedback."
status: pending
priority: P1
effort: "10h"
tags: ["mobile", "pantry", "date-parser", "localization", "ui-ux"]
created: 2026-09-07
---

# Mobile Pantry Flexible Natural Date Detection (13/9/26, Sep 13, 13 thg 9, Shorthand)

## Overview
When entering grocery item expiry dates manually, forcing users into rigid input formats (such as strictly requiring 4-digit years or hyphens) causes unnecessary friction. Real-world grocery packaging and human typing vary widely:
- Two-digit years: `13/9/26`, `13-09-26`, `13.9.26`
- Omitted years: `13/9`, `13/09`, `9/13` (intelligently defaulting to current or upcoming year)
- Named months: `Sep 13`, `13 Sep`, `September 13`, `13 thg 9`, `13 thang 9`
- Compact digits: `130926`, `13092026`, `20260913`
- Relative shorthand: `+3`, `3d`, `1w`, `2w`, `1m`, `3m`, `tomorrow`

This plan implements a comprehensive, locale-aware date detection engine (`naturalDateParser.ts`) that extracts the exact intended date from free-form user typing in real time, synchronizes the wheel picker drums simultaneously, provides a live formatted badge (`✓ 13 Sep 2026`), and confirms standard ISO strings (`YYYY-MM-DD`) into the pantry database.

## Architecture & Data Flow
```
User Types Free-Form String
(e.g., "13/9/26" or "Sep 13" or "13 thg 9" or "+1w" or "130926")
                         │
                         ▼
             [detectNaturalDate(input, { countryCode })]
                         │
        ┌────────────────┼────────────────┬────────────────┐
        ▼                ▼                ▼                ▼
 [Relative Offset] [Textual Month]  [Delimited Date] [Compact Digits]
  +3d, 1w, 2w, 3m   Sep 13, 13 thg 9 13/9/26, 13-9   130926, 20260913
        │                │                │                │
        └────────────────┴────────────────┴────────────────┘
                         │
                         ▼
             [Country Locale Priority]
         (VN -> DMY, US -> MDY, with Smart >12 day detection)
                         │
                         ▼
             [Leap Year & Calendar Bounds Validation]
                         │
                         ▼
                 [Valid Result?]
                ├── YES ──────────────────────────────────────┐
                │                                             ▼
                ▼                                    [Real-Time Wheel Sync]
       [Live Pill Badge]                             - Day drum -> 13
       "✓ 13 Sep 2026"                               - Month drum -> September
       (in Mint Mist #D6F0E6)                        - Year drum -> 2026
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
                       [Keyboard Enter or "Done" Press]
                                       │
                                       ▼
                             [createLocalRecord]
                           Persists: "2026-09-13"
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Resilient natural date parsing recognizing 2-digit years, day/month formats, English/Vietnamese months, compact digits, and relative shorthand | P1 |
| 2 | Seamless real-time synchronization between typed input and the 3-column wheel drum picker | P1 |
| 3 | Instant visual validation with live formatted pill badge (`✓ 13 Sep 2026`) and helpful locale-aware hints | P1 |
| 4 | Locale-aware parsing (Vietnam `DMY` vs US `MDY`) with smart $> 12$ day disambiguation | P1 |
| 5 | Full automated test suite (100% pass), local Gradle build, and live verification on Xiaomi MI 9 | P1 |

## Phases

| # | Phase | Status | Effort | Deliverables |
|---|-------|--------|--------|--------------|
| 1 | [Phase 1: Robust Multi-Pattern Natural Date Detection Engine](./phase-01-natural-date-parser-engine.md) | Pending | 4h | `naturalDateParser.ts`, regex patterns, locale disambiguation, relative offsets, validation. |
| 2 | [Phase 2: Integration into Date Pickers and Forms](./phase-02-integration-into-date-pickers-and-forms.md) | Pending | 3h | Connect parser into `WheelDatePickerModal`, live wheel spinning, dynamic placeholder, Enter key confirmation. |
| 3 | [Phase 3: Automated Testing Build and Device Verification](./phase-03-automated-testing-build-and-device-verification.md) | Pending | 3h | Exhaustive parser tests (all patterns), Gradle debug APK build, ADB install, live Xiaomi MI 9 testing. |

## Success Criteria

- [ ] Typing `13/9/26` immediately highlights September 13, 2026 on the wheel drums and displays `✓ 13 Sep 2026`.
- [ ] Typing `Sep 13` or `13 Sep` highlights September 13 of the current year.
- [ ] Typing Vietnamese `13 thg 9` or `13 thang 9` parses to September 13.
- [ ] Typing relative shorthand (`+3`, `3d`, `1w`, `2w`, `1m`, `3m`) computes exact future dates.
- [ ] Compact digits like `130926` parse correctly into Day 13, Month 9, Year 2026.
- [ ] Tapping Done or pressing keyboard Enter confirms the ISO date (`YYYY-MM-DD`) into the parent form.
- [ ] All unit tests pass (`pnpm --filter mobile test`) and typecheck passes with 0 errors (`pnpm --filter mobile typecheck`).
- [ ] Android APK built and verified live on Xiaomi MI 9 (`96d9c774`).

## Validation Log

### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Standard
- Components confirmed: `WheelDatePickerModal.tsx`, `AddRecordForm.tsx`, `QuickEditModal.tsx`, `country-format.ts`, `getCountryMetadata`, `formatDate`.

### Session 1 - Critical Questions Interview
- **Q1 (Year Inference)**: When Day and Month are typed without year (`13/9`, `Sep 13`), default to current year; if the date has already passed relative to today, roll forward to next year.
  - *Decision*: Immediate roll-forward confirmed (no arbitrary 30-day grace).
- **Q2 (Ambiguity Resolution)**: When numbers are <= 12 (`05/06`), resolve by user's country (`VN` -> DMY, `US` -> MDY); if either number > 12, auto-assign to Day.
  - *Decision*: Country-driven with >12 auto-detect confirmed.
- **Q3 (Vietnamese Tokens)**: Support comprehensive Vietnamese phrasing (`thang 1`–`thang 12`, `thg 1`–`thg 12`, `th01`–`th12`, with and without diacritics).
  - *Decision*: Comprehensive Vietnamese tokens confirmed.
- **Q4 (Partial Typing Feedback)**: Quiet live parsing (keep wheel at current valid date while typing is in progress; only show error if length >= 4 and unrecognized on blur/submit).
  - *Decision*: Quiet live parsing confirmed.

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across `plan.md`, `phase-01`, `phase-02`, and `phase-03`.
- Terminology aligned: `detectNaturalDate`, `countryCode`, `dateFormat`.

<!-- slug: mobile-pantry-flexible-natural-date-detection -->
