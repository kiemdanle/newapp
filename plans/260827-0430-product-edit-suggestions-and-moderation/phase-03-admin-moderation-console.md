---
phase: 3
title: "Admin moderation console"
status: completed
priority: P2
dependencies: [1, 2]
---

# Phase 3: Admin moderation console

<!-- Updated: Validation Session 1 - Added submitter reason card and shelf life comparison row -->
<!-- Updated: Red Team Review - Shelf life formatted comparison helper, sanitized submitter note card, null-safe diff rendering -->

## Overview
Enhance the Admin Dashboard's Unified Moderation Queue (`/products/pending`) and Revision Detail Screen (`/products/pending/[editId]`) to display complete product detail comparisons—including Default Shelf Life Days, Category, Brand, Name, Description, Submitter Reason/Notes card, and side-by-side Photo sets—enabling moderators to efficiently review and resolve edit suggestions.

## Requirements

### Functional
- Update `LiveProductView` and `RevisionView` interfaces in `apps/admin/src/app/(admin)/products/[id]/revision-comparison.tsx` to include `defaultShelfLifeDays: number | null` and `notes: string | null`.
- Render a dedicated comparison row for `Default shelf life` with formatted values (`${days} days` or `—`), ensuring accurate visual diff highlighting when the value changes (e.g. `Live: 30 days` vs. `Proposed: 45 days`, or `Live: —` vs `Proposed: 60 days`).
- Render a prominent **Submitter's Reason for Suggestion** card displaying `revision.notes` (e.g. "Barcode is correct, but shelf life is 14 days based on fresh bakery label") with clean formatting and wrapping so moderators understand the context behind the proposed edits.
- Ensure the live vs. proposed photo comparison correctly renders retained photos, newly staged photos, and removed photos with clear status badges.
- Ensure approval (`Approve` button) and change requests (`Request Changes` with reason input) trigger smoothly and refresh the queue state.

### Non-functional
- Conform to the Expyrico Admin design language and theme tokens.
- Accessible tables, clear typography ramp, and responsive layout for mobile/tablet admin viewports.
- Resilient error boundaries and loading states for media proxies.

## Architecture
```
Admin Moderation Page (/products/pending/[editId])
  │
  ├── Header & Submitter Info (User ID, Submission Timestamp, StatusBadge)
  │
  ├── Submitter Note Card (revision.notes rationale/evidence)
  │
  ├── RevisionComparison Component
  │     ├── Table Diff: Name, Brand, Category, Description, Default Shelf Life Days
  │     └── Grid Diff: Live Photos (N) vs. Proposed Photos (M)
  │
  └── Action Footer
        ├── PendingActions (Approve / Request Changes with Notes)
        └── RecoveryActions (if revision is stale vs live product version)
```

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/products/[id]/revision-comparison.tsx`
- Modify: `apps/admin/src/app/(admin)/products/pending/[editId]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/pending/page.tsx`
- Create/Modify: `apps/admin/tests/e2e/moderation.spec.ts` (or relevant admin tests)

## Implementation Steps
1. In `apps/admin/src/app/(admin)/products/[id]/revision-comparison.tsx`:
   - Update `LiveProductView` interface to include `defaultShelfLifeDays: number | null`.
   - Update `RevisionView` interface to include `defaultShelfLifeDays: number | null; notes?: string | null`.
   - Add a formatting helper function `formatShelfLife(days: number | null): string => days ? `${days} days` : '—'`.
   - In `RevisionComparison`, add a `FieldRow` for `Default shelf life` comparing `formatShelfLife(live.defaultShelfLifeDays)` with `formatShelfLife(revision.defaultShelfLifeDays)`.
   - If `revision.notes` is non-empty, render a styled callout card:
     ```tsx
     <div className="rounded-lg border border-accent/30 bg-accent-light/20 p-3.5">
       <div className="flex items-center gap-2 text-xs font-semibold text-accent-dark">
         <span>💡 Submitter Note / Reason</span>
       </div>
       <p className="mt-1 text-sm text-neutral-dark whitespace-pre-wrap">{revision.notes}</p>
     </div>
     ```
2. In `apps/admin/src/app/(admin)/products/pending/[editId]/page.tsx`:
   - Ensure `serverAdminApi.products.getPendingEdit` passes `defaultShelfLifeDays` and `notes` to `RevisionComparison`.
   - Ensure `liveRow` passes `defaultShelfLifeDays` to `RevisionComparison`.
3. In `apps/admin/src/app/(admin)/products/pending/page.tsx`:
   - Verify the pending queue list displays revision cards with item title, creator email/ID, and submission age accurately.
4. Run `pnpm --filter @expyrico/admin build` and verify typechecking and build artifacts.

## Success Criteria
- [x] Admin Revision comparison view clearly shows live vs proposed values for all product fields including `defaultShelfLifeDays`.
- [x] Submitter's note/reason card renders prominently when notes are present.
- [x] Approving a revision successfully triggers API call, redirects/updates UI, and live product displays updated information.
- [x] Requesting changes records admin moderation note and updates revision status.
- [x] `apps/admin` builds cleanly with zero TypeScript errors.

## Risk Assessment
- *Risk*: Submitter notes containing long or unformatted text overflowing the layout.
- *Mitigation*: Use CSS `whitespace-pre-wrap` and `break-words` with max container height and scroll if necessary.
