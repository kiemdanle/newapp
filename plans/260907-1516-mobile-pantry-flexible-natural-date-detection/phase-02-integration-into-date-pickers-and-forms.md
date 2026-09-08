---
phase: 2
title: "Integration into Date Pickers and Forms"
status: pending
priority: P1
effort: "3h"
dependencies: [1]
---

# Phase 2: Integration into Date Pickers and Forms
<!-- Updated: Validation Session 1 - Quiet live parsing, error only on blur or submit if unrecognized -->

## Overview
Connect the natural date parser engine into `WheelDatePickerModal`, `AddRecordForm`, and `QuickEditModal`, providing real-time live preview badges, automatic wheel drum rotation as the user types free-form text, and seamless confirmation.

## Requirements
- Functional:
  - In `WheelDatePickerModal.tsx`:
    - Replace local parsing logic with `detectNaturalDate(typedText, { countryCode: userCountry })`.
    - Real-time live synchronization: as user types any recognized natural pattern (`Sep 13`, `13/9/26`, `13 thg 9`, `+1w`, `3m`, `2026-10-31`):
      - Live preview pill badge immediately updates to localized string (e.g. `✓ 13 Sep 2026`).
      - Wheel drum columns (Day, Month, Year) automatically scroll to match the parsed date in real-time.
      - Input error clears immediately upon detection.
    - Placeholder and helper text:
      - Shows dynamic examples based on user country:
        - Vietnam: `e.g. 13/9/26, Sep 13, +1w`
        - US: `e.g. 9/13/26, Sep 13, +1w`
    - On keyboard Enter or "Done" button press:
      - If input is non-empty, confirms the detected ISO date and dismisses modal.
      - If input is invalid, displays inline error: `"Please enter a valid date (e.g. 13/9/26, Sep 13, +1w)"` and blocks confirmation.
  - In `AddRecordForm.tsx` & `QuickEditModal.tsx`:
    - Display localized date strings using `formatDate(expiry, userCountry)`.
- Non-functional:
  - Zero layout shift during live typing.
  - Input field uses `keyboardType="default"` or `"numbers-and-punctuation"` to allow typing letters (for month names like `Sep` or `thg`) and symbols (`/`, `-`, `+`).

## Architecture
```
User Types in Date Input Bar
       │
       ▼
[handleTypedTextChange]
       │
       ▼
[detectNaturalDate(text, { countryCode })]
       │
       ├──> Valid Result?
       │    ├── Update selectedYear, selectedMonth, selectedDay
       │    ├── WheelColumn refs scrollTo matched values (animated: true)
       │    ├── Live Badge displays `✓ ${formatted}` in Mint Mist badge
       │    └── Clear inputError
       │
       └──> Incomplete / Invalid?
            ├── If text.length >= 4 and no match: show helpful hint
            └── If empty: clear error
```

## Related Code Files
- Modify: `apps/mobile/src/components/WheelDatePickerModal.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/features/records/QuickEditModal.tsx`

## Implementation Steps
1. In `WheelDatePickerModal.tsx`:
   - Import `detectNaturalDate` from `../utils/naturalDateParser`.
   - Update `handleTypedTextChange`:
     - Run `detectNaturalDate(text, { countryCode: userCountry })`.
     - When a match is found:
       - Update `selectedYear`, `selectedMonth`, `selectedDay`.
       - Scroll wheel columns to the parsed index.
       - Clear `inputError`.
   - Update `handleConfirm`:
     - Validate via `detectNaturalDate`.
     - Confirm ISO date `YYYY-MM-DD`.
   - Set `keyboardType="default"` with `autoCapitalize="words"` so users can easily type numbers (`13/9/26`), letters (`Sep 13`, `13 thg 9`), and shorthand (`+1w`).
2. Update unit tests in `WheelDatePickerModal.test.tsx` to verify typing `Sep 13`, `13/9/26`, and relative shorthand `+1w`.

## Success Criteria
- [x] Typing `13/9/26` immediately highlights September 13, 2026 on the wheel drums.
- [x] Typing `Sep 13` immediately highlights September 13 of current year on the wheels.
- [x] Typing `+1w` immediately highlights the date 7 days from now.
- [x] Pressing Enter or tapping Done confirms the detected date into the parent form.

## Risk Assessment
- Risk: Keyboard layout when typing letters vs numbers.
  - Mitigation: `keyboardType="default"` allows typing both digits and letters seamlessly on mobile keyboards without mode switching.
