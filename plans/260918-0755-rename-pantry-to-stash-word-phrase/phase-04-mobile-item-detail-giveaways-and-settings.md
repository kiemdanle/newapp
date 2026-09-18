---
phase: 4
title: "Mobile Item Detail, Giveaways & Settings"
status: pending
priority: P1
effort: "2h"
dependencies: [3]
---

# Phase 4: Mobile Item Detail, Giveaways & Settings

## Overview

Update user-facing copy on the Item Detail screen, Community Giveaway & Deal fast-fill modals, Household settings & invite share dialogues, and Auth/Onboarding screens from "Pantry" to "Stash", while strictly preserving physical storage location presets.

## Requirements

### Functional Requirements
- **Item Detail Screen (`record/[id].tsx`)**:
  - Fallback name: `displayName || 'Stash Item'` (was `'Pantry Item'`).
  - Error and return buttons: `'Back to stash'` (was `'Back to pantry'`).
  - Error copy: `"We couldn't connect to your stash to load this item. Please check your network and try again."`
  - Removal copy: `"This record may have been removed from your stash."`
  - Delete dialogue: `"Are you sure you want to delete \"{displayName}\"? It will be removed from your stash."`
  - Giveaway conflict dialogue: `"This stash item is currently offered in a community giveaway. Please cancel the giveaway before marking it as used or discarded."`
  - Restore action: Button label `'Restore to Stash'`, alert title `'Restored to Personal Stash'`, message `"Your previous household is no longer accessible, so this item was restored to your personal stash."`
  - Storage Location spec:
    - Spec field label: `'Stash Location'` (was `'Pantry Location'`).
    - Default personal label: `'Personal Stash'` (was `'Personal Pantry'`).
    - Accessibility labels: `'Change stash location, currently {locationLabel}'`, `'Dismiss stash move dialogue'`, `'Move to Personal Stash'`.
  - Photo modals: `'Select a new photo to represent this stash item'`, `'Saving to stash…'`.
  - Additional logging: Link and accessibility label `'Add another to stash'`.
- **Community Giveaways & Deals**:
  - `giveaway/new.tsx`: Hero card title `'Select from Your Stash'` with `FAST FILL` badge.
  - `PantrySelectModal.tsx`:
    - Title: `'Select from Stash'`.
    - Subtitle: `"Choose an item to auto-fill details, photos, and expiry date."`
    - Search placeholder & accessibility label: `'Search stash items'`.
    - Fallback name: `'Stash item'`.
    - Empty state title: `'Your stash is empty'`.
    - Empty state subtitle: `"Add items to your stash first or enter giveaway details manually."`
    - Close accessibility label: `'Close stash selection'`.
  - `deal/new.tsx`: Fast fill button `'Select from stash'`.
- **Household & Settings**:
  - `settings/index.tsx`:
    - Household subtitle: `'Share a stash with your people'`.
    - Default stash row label: `'Default Stash'`.
    - Accessibility label: `'Default Stash for New Items'`.
  - `DefaultPantryModal.tsx`:
    - Title: `'Default Stash for New Items'`.
    - Subtitle: `"New items scanned or created manually will automatically be assigned to this stash."`
    - Option 1 label: `'Personal Stash (Private)'`.
  - `HouseholdInviteCard.tsx`:
    - Share sheet message: `"Join my stash \"{householdName}\" on Expyrico so we can track shared groceries and expiry together! Use invite code {code} or tap: {shareUrl}"`
    - Card description: `"Share this code or link with your partner, family, or roommates so they can join your shared stash."`
- **Auth & Onboarding Screens**:
  - `welcome.tsx`: `"Keep your stash visible, catch expiry dates early, and choose what to use next."`
  - `sign-in.tsx`: `"Sign in to your Expyrico stash"`
  - `sign-up.tsx`: `"Start tracking stash items with expiry alerts and fresh-use suggestions."`
  - `reset-password.tsx`: `"Use a strong, memorable password to protect your stash."`
  - `profile.tsx`: Footer text `"Expyrico • Fresh & Waste-Free Stash"`.
- **Strict Exclusions**:
  - `apps/mobile/src/utils/locations.ts`: `COMMON_OTHER_LOCATIONS` (`'Pantry'`, `'Counter'`, etc.) and `LocationSelector.tsx` MUST retain `'Pantry'` as the physical storage location preset!

### Non-Functional Requirements
- Maintain UK English conventions (`dialogue`, `catalogue`, `centre`).
- Keep component and hook imports unchanged (`usePantryScope`, `PantrySelectModal`) so internal architecture remains intact.

## Architecture

```
Item Detail & Actions
  ├── Stash Location: Personal Stash / Household Name
  ├── Modals: Save to stash · Delete from stash · Restore to Stash
  └── Link: Add another to stash

Giveaways / Deals
  └── Hero Card: "Select from Your Stash" ──> Fast Fill Modal: "Select from Stash"

Settings & Households
  ├── Household Row: "Share a stash with your people"
  ├── Default Stash Modal: "Default Stash for New Items"
  └── Invite Card: "Join my stash {name} on Expyrico..."

Auth & Onboarding
  └── Welcome / Sign In: "Keep your stash visible..." / "Sign in to your Expyrico stash"
<!-- Updated: Red Team Review Session - F5 unit test assertions -->


## Related Code Files

### Modify
- `apps/mobile/app/(app)/record/[id].tsx`
- `apps/mobile/app/(app)/giveaway/new.tsx`
- `apps/mobile/app/(app)/deal/new.tsx`
- `apps/mobile/src/features/giveaways/PantrySelectModal.tsx`
- `apps/mobile/app/(app)/settings/index.tsx`
- `apps/mobile/src/features/settings/DefaultPantryModal.tsx`
- `apps/mobile/src/features/households/HouseholdInviteCard.tsx`
- `apps/mobile/app/(app)/(tabs)/profile.tsx`
- `apps/mobile/app/(auth)/welcome.tsx`
- `apps/mobile/app/(auth)/sign-in.tsx`
- `apps/mobile/app/(auth)/sign-up.tsx`
- `apps/mobile/app/(auth)/reset-password.tsx`
- `apps/mobile/__tests__/PantrySelectModal.test.tsx`
- `apps/mobile/tests/unit/scope-selector-pill.test.tsx`

## Implementation Steps

1. Edit `apps/mobile/app/(app)/record/[id].tsx`:
   - Update fallback item name to `'Stash Item'`.
   - Update error and return buttons to `'Back to stash'`.
   - Update delete, giveaway conflict, and restore dialogue strings.
   - Update `Pantry Location` label to `Stash Location` and default value to `Personal Stash`.
   - Update photo modals to `'Select a new photo to represent this stash item'` and `'Saving to stash…'`.
   - Update `'Add another to pantry'` to `'Add another to stash'`.
2. Edit `apps/mobile/app/(app)/giveaway/new.tsx` and `deal/new.tsx`:
   - Update fast-fill hero card title to `'Select from Your Stash'`.
   - Update deal button label to `'Select from stash'`.
3. Edit `apps/mobile/src/features/giveaways/PantrySelectModal.tsx`:
   - Update modal title, search placeholder, item fallback, and empty state strings to `stash`.
4. Edit `apps/mobile/app/(app)/settings/index.tsx`:
   - Update household subtitle and default stash setting row labels.
5. Edit `apps/mobile/src/features/settings/DefaultPantryModal.tsx`:
   - Update title, description, and personal stash option labels.
6. Edit `apps/mobile/src/features/households/HouseholdInviteCard.tsx`:
   - Update share text and card description to `stash`.
7. Edit `apps/mobile/app/(app)/(tabs)/profile.tsx` and auth screens:
   - Update footer and auth header descriptions to reference `stash`.
8. Update unit test assertions in `PantrySelectModal.test.tsx` and `scope-selector-pill.test.tsx`:
   - Update `scope-selector-pill.test.tsx:167` to assert `'Default Stash for New Items'`.
   - Update `PantrySelectModal.test.tsx` for `'Search stash items'` and `'Your stash is empty'`.

## Success Criteria

- [x] Item detail screen displays "Stash Item", "Stash Location", and "Back to stash".
- [x] Giveaway fast fill hero displays "Select from Your Stash".
- [x] Item selection modal displays "Select from Stash" and "Your stash is empty".
- [x] Household settings row displays "Share a stash with your people".
- [x] Default stash modal displays "Default Stash for New Items".
- [x] Household share sheet message sends "Join my stash...".
- [x] Onboarding screens display "Keep your stash visible...".
- [x] Physical storage location preset `'Pantry'` in `LocationSelector.tsx` is preserved.
- [x] Mobile item detail, giveaway, and settings unit tests pass.

## Risk Assessment

- **Risk**: Renaming internal `target: 'pantry'` in navigation params that might break deep links.
- **Mitigation**: Only update display text, labels, and accessibility strings. Keep navigation target identifiers (`target: 'pantry'`) stable unless required.
