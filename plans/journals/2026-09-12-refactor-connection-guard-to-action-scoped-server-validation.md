---
title: Refactor Connection Guard to Action-Scoped Server Validation Gating
date: 2026-09-12
summary: "Refactored connection guard from global blocker to action-scoped validation gating, enabling offline pantry browsing while protecting server-dependent mutations."
---

# Refactor Connection Guard to Action-Scoped Server Validation Gating

### Summary of Delivery
Successfully adjusted the mobile connection guard per user requirements, transitioning from an app-wide full-screen blocking barrier to an **action-scoped server validation guard**:

1. **Offline-Safe Browsing**:
   - Removed the global blocking overlay from `App.tsx`.
   - Users can freely browse, search, and filter their pantry inventory (stored locally in WatermelonDB SQLite), inspect items, review cached feeds, and adjust settings while offline.
   - Added an unobtrusive, tappable `OfflineTopBanner.tsx` at the top of the app when disconnected: "Offline Mode • Server actions paused".

2. **Action-Scoped Server Validation Interception**:
   - Created `apps/mobile/src/store/connectionGuardStore.ts` with `requireServerConnection(actionName, onProceed)`.
   - Created `apps/mobile/src/components/ConnectionNoticeModal.tsx` displaying the serene Facebook-style error card as a focused modal dialog.
   - Features contextual action messaging ("Connection Required for Add Pantry Item"), diagnostic status pill, "Try Again" retry CTA with loading spinner, and a "Keep Browsing" dismiss button.
   - If user reconnects and taps "Try Again", the modal automatically executes the pending action callback upon `ready` confirmation.

3. **Guarded Mutation Entry Points**:
   - `AddRecordForm.tsx`: Adding a pantry item.
   - `QuickEditModal.tsx`: Updating pantry item fields (quantity, brand, date, location).
   - `ProductDraftForm.tsx`: Saving product draft metadata.
   - `ProductPhotoEditor.tsx`: Taking or selecting product photos for server upload.
   - `DraftSubmitPanel.tsx`: Submitting product draft for moderation.
   - `profile/password.tsx`: Changing password.

### Verification
- **Unit Tests:** 26/26 connection tests passing, touch-target test (27/27 passing), and form tests passing.
- **Typecheck:** 0 errors across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`.
- **Device Verification:** Built APK via Gradle, installed on Android phone (`96d9c774`), confirmed offline pantry browsing, modal presentation on action attempt, clean dismissal on "Keep Browsing", and automatic banner disappearance + sync reconciliation on Wi-Fi reconnect.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
