---
phase: 3
title: "Country Locale & Regional Formatting Engine"
status: pending
priority: P1
dependencies: ["phase-01-data-model-shared-schemas.md"]
---

# Phase 3: Country Locale & Regional Formatting Engine
<!-- Updated: Red Team Review - Historical entity currency precedence & deterministic Hermes formatting -->

## Overview
This phase establishes a comprehensive regionalization and formatting engine. When a user updates their country in their profile, the app dynamically adjusts its locale, date and time format preferences, default currency formatting, and numeric notations across all mobile screens without requiring an app restart, while strictly preserving explicit historical entity currencies (e.g. Deals, Giveaways).

## Requirements

### Functional Requirements
1. **Country Metadata Registry (Zero Heavy Dependencies)**:
   - Maintain a lightweight, static dictionary of countries mapping ISO-3166-1 alpha-2 codes (e.g. `US`, `GB`, `CA`, `AU`, `VN`, `DE`, `FR`, `JP`, `SG`, `ES`, `IT`, `BR`, `MX`, etc.) to:
     - Country Name & Flag icon/emoji
     - Primary BCP-47 Locale tag (e.g. `en-US`, `en-GB`, `vi-VN`, `de-DE`, `ja-JP`)
     - Default ISO-4217 Currency Code (e.g. `USD`, `GBP`, `VND`, `EUR`, `JPY`)
     - Default Currency Symbol (e.g. `$`, `£`, `₫`, `€`, `¥`)
     - Date format pattern (e.g. `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`)
     - Default 12h vs 24h clock convention
2. **Formatting Utility Functions**:
   - `formatDate(date, countryCode, options)`: Formats ISO/Date strings adhering to country conventions with **deterministic zero-padded fallback templates** to ensure consistent rendering across bare Android Hermes JavaScript engines.
   - `formatTime(date, countryCode, options)`: Formats time adhering to 12h/24h standard.
   - `formatDateTime(date, countryCode, options)`: Formats combined timestamp.
   - `formatCurrency(amount, currencyOverride?, countryCode?)`: **Currency Precedence Rule**: If `currencyOverride` is provided (e.g. `deal.currency = "USD"`), formats using that explicit currency regardless of user country changes; falls back to user country's default currency only when formatting generic prices.
   - `formatNumber(number, countryCode)`: Formats decimal and integer numbers.
3. **Reactive Regional Hook (`useCountryFormat`)**:
   - Subscribes to `useSessionStore((s) => s.user?.country)`.
   - Falls back gracefully to system locale or `US` if country is unset.
   - Exposes pre-bound formatting methods (`formatDate`, `formatTime`, `formatCurrency`, `currencySymbol`, `activeCountry`) so components do not need to pass country code manually.
4. **App-Wide Adoption**:
   - Refactor Deal cards, Giveaway cards, Pantry expiry indicators, WheelDatePickerModal, Draft list timestamps, and Transaction displays to use `useCountryFormat`.

### Non-functional Requirements
- Formatting functions must be deterministic and safe against invalid/unrecognized country codes.
- No performance regressions on lists and VirtualizedFlatLists during re-renders.

## Architecture & Data Flow

```
                      +----------------------------------+
                      | User Updates Country in Profile  |
                      +----------------------------------+
                                       |
                                       v
                      +----------------------------------+
                      | useSessionStore(user.country)    |
                      +----------------------------------+
                                       |
                                       v
                      +----------------------------------+
                      | useCountryFormat() Hook          |
                      | - Resolves Locale (e.g. 'vi-VN') |
                      | - Resolves Currency ('VND')      |
                      | - Resolves Date Pattern (DMY)    |
                      +----------------------------------+
                                       |
         +-----------------------------+-----------------------------+
         |                             |                             |
         v                             v                             v
+------------------+          +------------------+          +------------------+
|  Deal Cards      |          |  Expiry Dates    |          |  Draft / Activity|
| (Overrides 'USD')|          |  (e.g. 26/08/26) |          |  (e.g. 14:30)    |
+------------------+          +------------------+          +------------------+
```

## Related Code Files
- Create: `apps/mobile/src/utils/country-format.ts`
- Create: `apps/mobile/src/utils/country-format.test.ts`
- Create: `apps/mobile/src/hooks/useCountryFormat.ts`
- Modify: `apps/mobile/src/components/WheelDatePickerModal.tsx`
- Modify: `apps/mobile/src/features/deals/DealCard.tsx`
- Modify: `apps/mobile/src/features/giveaways/ClaimList.tsx`
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`

## Implementation Steps
1. Implement country metadata dictionary and helper functions in `apps/mobile/src/utils/country-format.ts` with explicit `currencyOverride` prioritization and zero-padded date templates.
2. Implement unit tests in `apps/mobile/src/utils/country-format.test.ts` validating formatting across US, GB, VN, DE, and JP formats and checking `currencyOverride` behavior.
3. Build the `useCountryFormat` hook in `apps/mobile/src/hooks/useCountryFormat.ts` linking active session user country to formatters.
4. Replace raw `toLocaleDateString()` and hardcoded currency prefixes in `DealCard.tsx`, `ClaimList.tsx`, `drafts.tsx`, and `WheelDatePickerModal.tsx` with `useCountryFormat()`.
5. Verify that updating country in mock/test session immediately updates UI representations while preserving historical deal currencies.

## Success Criteria
- [ ] Changing country to `GB` displays dates as `DD/MM/YYYY` and currency as `£` / `GBP`.
- [ ] Changing country to `VN` displays dates as `DD/MM/YYYY` and currency as `₫` / `VND`.
- [ ] Deals with `currency: "USD"` continue to display `$ USD` even after user switches country to `VN` or `DE`.
- [ ] WheelDatePicker and all timestamp indicators reflect user's chosen country format.
- [ ] Unit tests pass with 100% coverage on country formatting utilities.

## Risk Assessment
- **Risk**: Edge case where `Intl.DateTimeFormat` or `Intl.NumberFormat` lacks polyfills on certain bare Android JS engines (Hermes).
  - **Mitigation**: Pure TypeScript template formatters act as primary or fallback implementations.
