---
phase: 4
title: "Action-Scoped Server Validation Guard & Modal Notice"
status: in-progress
priority: P1
effort: "4h"
dependencies: ["phase-01-start.md", "phase-02-facebook-style-connection-loss-notice-and-gating.md", "phase-03-post-reconnection-sync-and-verification.md"]
---

# Phase 4: Action-Scoped Server Validation Guard & Modal Notice

## Overview
Refactor the connection guard from an app-wide full-screen blocking overlay into an **action-scoped server validation guard**. Allow users to freely browse and interact with all offline-safe parts of the app (pantry list, search, filter, item details, cached feeds, appearance/settings), while strictly intercepting and gating actions that require server validation (creating pantry items, uploading photos, submitting drafts, updating records, changing password) with a modal notice and retry CTA.

## Requirements
- Functional:
  - Remove the global full-screen blocking overlay from `apps/mobile/src/App.tsx`.
  - Allow offline cold boot and navigation across read-only and offline-safe screens (Pantry inventory, search, filters, item details, settings).
  - Create a centralized action guard `requireServerConnection(actionName, onProceed)` and store `connectionGuardStore.ts`.
  - Create `ConnectionNoticeModal.tsx`:
    - Displays Facebook-style notice as a modal sheet / dialog.
    - Contextual action message: e.g. "Saving this pantry item requires an active server connection to ensure your data stays safely synced."
    - Shows diagnostic status pill (`Offline • Check network settings` vs. `Internet Active • Server Unreachable`).
    - Primary "Try Again" button with loading spinner.
    - Secondary "Cancel / Keep Browsing" button allowing user to dismiss without being trapped.
    - If user taps "Try Again" and connection resolves to `ready`, automatically dismisses and executes the pending action callback.
  - Guard key server-validation action entry points:
    - Pantry Item Creation & Editing (`AddRecordForm.tsx`, `QuickEditModal.tsx`, `PantryGridActionDrawer.tsx`).
    - Product Photo Upload & Draft Submission (`ProductDraftForm.tsx`, `DraftSubmitPanel.tsx`, `photo-picker-adapter.ts`).
    - Password & Security changes (`profile/password.tsx`, `settings/add-passkey.tsx`).
  - Add an optional slim, subtle top offline indicator bar in `App.tsx` when `status !== 'ready'` ("Offline Mode • Actions requiring server sync are paused").
- Non-functional:
  - Preserves Expyrico design tokens across Dark and Light themes.
  - Smooth modal presentation with backdrop blur/scrim.
  - Zero regression in offline browsing performance.
  - 100% type-safe with unit tests.

## Architecture
- `apps/mobile/src/store/connectionGuardStore.ts`:
  - `isModalVisible: boolean`
  - `pendingActionName: string | null`
  - `pendingCallback: (() => void) | null`
  - `triggerGuardedAction: (actionName: string, onProceed: () => void) => boolean`
  - `closeModal: () => void`
- `apps/mobile/src/components/ConnectionNoticeModal.tsx`:
  - Modal component listening to `connectionGuardStore` and `connectionStore`.
  - Shows retry CTA and cancel CTA.
- `apps/mobile/src/components/OfflineTopBanner.tsx`:
  - Subtle non-blocking status indicator shown when offline.
- `apps/mobile/src/App.tsx`:
  - Mounts `<ConnectionNoticeModal />` and `<OfflineTopBanner />`.
  - Unblocks `splashReady` on boot so user can immediately view their pantry.

## Related Code Files
- Create:
  - `apps/mobile/src/store/connectionGuardStore.ts`
  - `apps/mobile/src/components/ConnectionNoticeModal.tsx`
  - `apps/mobile/src/components/OfflineTopBanner.tsx`
  - `apps/mobile/src/store/__tests__/connectionGuardStore.test.ts`
  - `apps/mobile/src/components/__tests__/ConnectionNoticeModal.test.tsx`
- Modify:
  - `apps/mobile/src/App.tsx` (remove full-screen blocker, mount modal and top banner)
  - `apps/mobile/src/features/records/AddRecordForm.tsx` (wire `triggerGuardedAction` on submit)
  - `apps/mobile/src/features/records/QuickEditModal.tsx` (wire `triggerGuardedAction` on submit)
  - `apps/mobile/src/features/products/ProductDraftForm.tsx` (wire `triggerGuardedAction` on submit)

## Implementation Steps
1. Create `connectionGuardStore.ts` with `triggerGuardedAction(actionName, onProceed)`.
2. Create `ConnectionNoticeModal.tsx` and `OfflineTopBanner.tsx`.
3. Update `App.tsx` to remove root full-screen blocker and replace with `ConnectionNoticeModal` and `OfflineTopBanner`.
4. Wire `triggerGuardedAction` into pantry create/edit forms and product forms.
5. Add unit tests for `connectionGuardStore` and `ConnectionNoticeModal`.
6. Verify on physical Android device:
   - Browse pantry in offline mode (loads instantly).
   - Tap "Add Item" or attempt to save pantry item $\to$ modal notice appears with diagnostic pill and retry CTA.
   - Re-enable network, tap "Try Again" $\to$ action proceeds smoothly.

## Success Criteria
- [x] Users can browse pantry items, search, and navigate offline without any blocking screen.
- [x] Attempting to create or edit a pantry item offline opens `ConnectionNoticeModal`.
- [x] Attempting to upload photos or submit drafts offline opens `ConnectionNoticeModal`.
- [x] Modal displays diagnostic pill, "Try Again" button, and "Keep Browsing" cancel button.
- [x] Reconnecting dismisses the modal and allows the action to proceed.
- [x] All unit tests pass and Android Gradle build succeeds.
