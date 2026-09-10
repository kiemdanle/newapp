---
title: Slide Left Action Menu for Product Drafts
date: 2026-09-10
summary: "Implement slide-left swipe action menu (Edit, Add to Pantry, Delete) for product drafts across List and Grid views with multi-draft queue, independent 5-second undo deadlines, unmount flush, and optimistic cache reconciliation."
---

# Slide Left Action Menu for Product Drafts

Implement slide-left swipe action menu (Edit, Add to Pantry, Delete) for product drafts across List and Grid views with multi-draft queue, independent 5-second undo deadlines, unmount flush, and optimistic cache reconciliation.

## Problem & Context
Users previously had no quick inline actions to edit, discard, or add product drafts to their pantry without tapping through multi-level navigation. The pantry view already had gesture-driven actions (`react-native-gesture-handler/Swipeable`), but the Product Drafts screen lacked parity across List and Grid views.

## Key Architectural Decisions & Implementation
1. **Components**:
   - `DraftSwipeableRow.tsx`: Horizontal slide-left action row revealing Edit (Honey `#F5A623`), Add to Pantry (Fresh Sage `#4BAE8A`, active/pending only), and Delete (Alert Red `#E0442A`, draft/changes_required only).
   - `DraftGridActionDrawer.tsx`: Full-height overlay drawer with circular action buttons matching `PantryGridActionDrawer` design.
   - `DraftGridCard.tsx`: Wrapped card in `Swipeable` with layout tracking to reveal `DraftGridActionDrawer`.
   - `DraftUndoToast.tsx`: Item-addressed undo rows with safe animated enter/exit and unmount cleanup.

2. **Contextual Routing**:
   - `active` status: Navigates to `/product/:id/edit` (community catalog revision flow).
   - `pending` status: Opens `ProductActionModal` (view details and review status).
   - `draft` or `changes_required` status: Navigates to `ProductNew` draft editor with resume mode.

3. **Multi-Draft Discard Queue with Independent Deadlines**:
   - State: `pendingDiscards: Map<string, PendingDiscardEntry>`.
   - Each discarded item receives an independent 5,000ms timer without interfering with other pending deletions.
   - Tapping "Undo" on a specific item restores that item immediately while others continue their countdown.

4. **Defects Discovered & Resolved During Code Review**:
   - *Dependency array bug in unmount cleanup*: Effect cleanup previously ran on every state update because `pendingDiscards` was in deps, cancelling other active timers. Resolved by using `pendingDiscardsRef` with an empty dependency array `[]`.
   - *Query refetch flicker race*: When `DELETE` resolved, dropping optimistic hide before `GET` refetch completed caused deleted cards to briefly pop back into view. Resolved by updating TanStack Query cache via `queryClient.setQueriesData` in `useDiscardDraft` before releasing `pendingDiscards`.
   - *Unmount discard flush*: Navigating away before 5 seconds previously cleared timers without committing. Resolved by immediately flushing/committing all non-committed pending discards on unmount.
   - *WCAG AA/AAA contrast*: Updated foreground icons/text to Almost Black `#2C2C28` on Honey and Fresh Sage backgrounds.
   - *Accessible touch targets*: Expanded grid drawer circular action buttons to 48x48.

## Verification & Status
- 36/36 Jest tests passing in `apps/mobile` across `DraftSwipeableRow.test.tsx`, `DraftGridActionDrawer.test.tsx`, and `product-drafts.test.tsx` (all 24 tests passing).
- 82/82 Pantry regression tests passing across all pantry components, hooks, and integration workflows.
- Full repository typecheck passing (6/6 packages clean).
- Vendored `@expyrico/shared` distribution synchronized and verified against source build.
- Local Android debug APK assembled cleanly via Gradle (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`).
- **Status**: Phase 1 and Phase 2 completed. Phase 3 remains `in_progress` pending physical hardware attachment of device `96d9c774` for on-device swipe gesture confirmation.
> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
