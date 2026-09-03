---
phase: 2
title: "Mobile Share Sheet and Invite Code Display"
status: completed
priority: P1
effort: "3-4h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Mobile Share Sheet and Invite Code Display

## Overview
Redesign the household member invitation experience in `HouseholdSettings` by replacing the manual UUID input with a 1-tap native OS share sheet button and an Expyrico-themed invite code card.

## Requirements
- Functional:
  - Display the household's 6-character invite code prominently in an styled card with mono-spaced typography.
  - Provide a 1-tap **Copy Code** button that copies to clipboard and triggers a brief "Copied!" feedback state.
  - Provide a primary **Invite Partner or Roommate** button:
    - Invokes React Native's built-in `Share.share(...)`.
    - Shares an inviting message:
      `Join my pantry "${household.name}" on Expyrico so we can track shared groceries and expiry together! Use code ${code} or tap: expyrico://household/join?code=${code}`
  - Keep a clean, compact layout in `HouseholdSettings.tsx` that replaces the clunky raw UUID text input.
  - For owners, provide a subtle "Regenerate Code" button (with confirmation alert) to cycle a new invite code if an existing link was compromised.
- Non-functional / Visual:
  - Adhere strictly to Expyrico design tokens:
    - Code card background: `theme.colors.bgElevated` or `theme.colors.bgGlass` with `theme.colors.border`.
    - Primary CTA button: Fresh Sage `#4BAE8A` with white text.
    - Secondary/Copy button: Mint Mist `#D6F0E6` with Deep Sage `#3A8F6F` text.
  - Full accessibility labels and touch targets ($\ge 44$pt).

## Architecture
```
[HouseholdSettings Screen]
         │
         ├── Household Header (Name, Members Count, Role)
         │
         ├── [Invite Section: "Invite to Household"]
         │     ├── Invite Code Box: [ K I T C H 8 ] [ Copy ]
         │     │
         │     └── Button: [ ✉ Invite via Message / Link ]
         │                   │
         │                   ▼
         │           Share.share({
         │             title: 'Join my Expyrico Pantry',
         │             message: 'Join my pantry "Family Kitchen"...',
         │             url: 'expyrico://household/join?code=KITCH8'
         │           })
         │
         └── Current Members List (Owner, Members, Remove action)
```

## Related Code Files
- Modify: `apps/mobile/src/api/households.ts` (type updates for `Household` with `inviteCode`)
- Create: `apps/mobile/src/features/households/HouseholdInviteCard.tsx`
- Modify: `apps/mobile/src/features/households/HouseholdSettings.tsx`
- Create: `apps/mobile/tests/unit/household-invite-card.test.tsx`

## Implementation Steps
1. Update `apps/mobile/src/api/households.ts` to consume `inviteCode` from the API response.
2. Build `HouseholdInviteCard.tsx`:
   - Renders 6-character code in a stylized container.
   - Handles Clipboard copy using `@react-native-clipboard/clipboard` or fallback.
   - Handles `Share.share` with proper title, message, and deep link URL.
   - Handles "Regenerate Code" mutation via `useRegenerateInviteCode()` with confirmation prompt.
3. Integrate `HouseholdInviteCard` into `HouseholdSettings.tsx`, replacing or upgrading `AddMemberForm`.
4. Ensure accessibility announcements (`accessibilityLabel="Copy household invite code KITCH8"`).
5. Add comprehensive unit tests in `apps/mobile/tests/unit/household-invite-card.test.tsx` verifying copy action, share triggering, and fallback states.

<!-- Updated: Validation Session 1 - Added owner code regeneration affordance -->

## Success Criteria
- [x] Tapping "Invite via Message" opens the native share dialog with pre-populated message and link.
- [x] Tapping "Copy" copies the 6-character code to the clipboard and shows visual confirmation.
- [x] Household members count and active invite code are visible immediately to the owner.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: Some older Android devices or share targets may not handle custom URI schemes (`expyrico://`) in the `url` field of `Share.share`.
- **Mitigation**: Include both the text explanation with the code and the universal/app URI directly inside the share `message` body string.
- **Observable Signal**: Shared link stripped in WhatsApp or SMS preview.
- **Pre-decided Response**: Structure message to always print `Use code: KITCH8 or tap: expyrico://household/join?code=KITCH8`.
