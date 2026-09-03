---
phase: 3
title: "Mobile Join Household Modal and Deep Link"
status: completed
priority: P1
effort: "3-4h"
dependencies: ["phase-02-mobile-share-sheet-and-invite-code.md"]
---

# Phase 3: Mobile Join Household Modal and Deep Link

## Overview
Implement an accessible "Join Household" modal with code input, deep-link routing (`expyrico://household/join?code=...`), and automatic cache and scope updates upon joining.

## Requirements
- Functional:
  - Add `useJoinHousehold()` mutation in `apps/mobile/src/api/households.ts` hitting `POST /v1/households/join`.
  - Create `JoinHouseholdModal.tsx`:
    - Clean text input formatted for 6-character alphanumeric uppercase codes (`autoCapitalize="characters"`, `maxLength={8}`).
    - When a valid code is submitted: calls `joinHousehold.mutateAsync({ code })`.
    - Shows loading spinner during request.
    - Displays clean inline error when code is invalid or user is already a member.
    - On success: invalidates queries, closes modal, and alerts/notifies user.
    - In confirmation mode (via deep link or pre-filled code): shows an explicit confirmation card ("Join [Household Name]? You will share pantry items with [Owner Name]") with [Join Household] and [Cancel] buttons before executing the mutation to prevent accidental joins.
  - Deep Link Integration:
    - Extend `DeepLinkHandler` in `apps/mobile/src/navigation/RootNavigator.tsx` to recognize `expyrico://household/join?code=...`.
    - If user is already authenticated: opens the Join Household modal pre-filled with the code or joins with 1-tap confirmation.
    - If user is logged out: captures pending invite code into storage (similar to `pendingReferralStore`), joining automatically once authenticated.
  - Add "Join with Code" button on the Household management screen so users can also type a code manually.

## Architecture
```
Deep Link (expyrico://household/join?code=KITCH8)
                   │
                   ▼
       RootNavigator DeepLinkHandler
                   │
         Authenticated?
        ├── Yes ──► Open JoinHouseholdModal(code="KITCH8")
        └── No  ──► pendingHouseholdInviteStore.set("KITCH8")
                            │
                    Post-Login Hook ──► Join Prompt
```

## Related Code Files
- Modify: `apps/mobile/src/api/households.ts` (add `useJoinHousehold`)
- Create: `apps/mobile/src/features/households/JoinHouseholdModal.tsx`
- Create: `apps/mobile/src/store/pendingHouseholdInviteStore.ts`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Modify: `apps/mobile/app/(app)/household/index.tsx`
- Create: `apps/mobile/tests/unit/join-household.test.tsx`

## Implementation Steps
1. Add `useJoinHousehold()` in `apps/mobile/src/api/households.ts` with query invalidation for `['households']` and `['records']`.
2. Build `JoinHouseholdModal.tsx` with uppercase code formatting, error state handling, and Expyrico palette styling.
3. Add "Join a Household" button next to "Create a household" in `apps/mobile/app/(app)/household/index.tsx`.
4. Create `pendingHouseholdInviteStore.ts` for capturing invite codes across auth boundaries.
5. Update `RootNavigator.tsx` to handle `expyrico://household/join?code=...` and trigger the join flow.
6. Write unit tests in `apps/mobile/tests/unit/join-household.test.tsx` covering modal behavior, code input sanitization, error messages, and deep link parsing.

<!-- Updated: Validation Session 1 - Explicit confirmation card before joining -->

## Success Criteria
- [x] Users can enter a 6-character code and join a household in 1 tap.
- [x] Deep links (`expyrico://household/join?code=XYZ123`) open the app and populate the code automatically.
- [x] Newly joined household immediately appears in the user's household list.
- [x] Local cache syncs and shared groceries show up in the pantry view without restarting the app.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: User clicks invite link when not logged in or during onboarding.
- **Mitigation**: Persist pending invite code in AsyncStorage (`pendingHouseholdInviteStore`), and immediately pop the join confirmation dialog after user signs in.
- **Observable Signal**: Users complaining invite link "did nothing" when opening before logging in.
- **Pre-decided Response**: Test cold-start with pending invite code.
