---
phase: 2
title: "Mobile Client Confirmation & Scope Optimization"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Mobile Client Confirmation & Scope Optimization

## Overview
Updates `apps/mobile/app/(app)/product/new.tsx` to conditionally reflect product moderation status upon submission. When auto-approved (`status: 'active'`), the confirmation states "Published to catalog" and enables household scope selection. When moderation is required (`status: 'pending'`), it displays "Submitted for review" with scope locked to personal until approved.

## Requirements
- **Functional**:
  - In `apps/mobile/app/(app)/product/new.tsx:156-180`, inspect `submittedProduct.status`.
  - If `submittedProduct.status === 'active'`:
    - Display confirmation header: `"Published to catalog — you can add it to your pantry now."`
    - Pass `lockedPersonalScope={false}` to `AddRecordForm`, enabling the user to immediately assign the newly created product to any household pantry they belong to.
  - If `submittedProduct.status === 'pending'` (or any non-active status):
    - Display confirmation header: `"Submitted for review — you can add it to your pantry now."`
    - Pass `lockedPersonalScope={true}` to `AddRecordForm`, keeping the item locked to personal pantry until moderation completes.
- **Non-Functional**:
  - Preserve `testID="new-product-submitted-message"` on the confirmation `Text` component to maintain test compatibility.
  - Comply with Expyrico Color Guidelines: text uses `theme.colors.text` (`#2C2C28` Almost Black) and font weight `600`.

## Architecture
When a product draft is submitted via `apiClient.post('/products/drafts/:id/submit')`, the server returns the serialized `ApiProduct`.
- Under `requireApproval: false` (or auto-approval), the returned product has `status: 'active'`.
- Under `requireApproval: true`, the returned product has `status: 'pending'`.

Currently, `new.tsx` indiscriminately renders:
```tsx
<Text testID="new-product-submitted-message" style={{ color: theme.colors.text, fontWeight: '600' }}>
  Submitted for review — you can add it to your pantry now.
</Text>
<AddRecordForm
  ...
  lockedPersonalScope
/>
```
This causes the interface in Image #1: even when auto-approved, the screen falsely informs the user that the item was submitted for review. Updating this component to branch on `submittedProduct.status === 'active'` synchronizes the visual messaging with the backend lifecycle.

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/new.tsx`
- Inspect: `apps/mobile/src/features/records/AddRecordForm.tsx`

## Implementation Steps
1. In `apps/mobile/app/(app)/product/new.tsx`:
   - Locate the `if (submittedProduct)` block around line 156.
   - Compute `const isApproved = submittedProduct.status === 'active';`.
   - Update the message text inside `testID="new-product-submitted-message"`:
     ```tsx
     {isApproved
       ? 'Published to catalog — you can add it to your pantry now.'
       : 'Submitted for review — you can add it to your pantry now.'}
     ```
   - Update `AddRecordForm` invocation to:
     ```tsx
     <AddRecordForm
       productId={submittedProduct.id}
       productName={submittedProduct.name}
       initialCategory={submittedProduct.category}
       lockedPersonalScope={!isApproved}
       onSaved={async () => {
         await ensurePushTokenRegistered();
         navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
       }}
     />
     ```
2. Run TypeScript typecheck to verify prop contracts:
   `npm --prefix apps/mobile run typecheck`

## Success Criteria
- [ ] Submitting an auto-approved product (`status: 'active'`) renders "Published to catalog — you can add it to your pantry now."
- [ ] Submitting a pending product (`status: 'pending'`) renders "Submitted for review — you can add it to your pantry now."
- [ ] Auto-approved products allow choosing between Personal and Household scope in `AddRecordForm`.
- [ ] TypeScript check passes with 0 diagnostics.

## Risk Assessment
- **Risk**: Existing unit tests for `product-new.test.tsx` might check for exact text matching "Submitted for review".
- **Observable Signal**: Jest test failure in `apps/mobile/__tests__/routes/product-new.test.tsx`.
- **Mitigation**: `product-new.test.tsx:192` tests `expect(await findByTestId('new-product-submitted-message')).toBeTruthy()` which matches the testID regardless of text. We will also add explicit text assertions for both active and pending branches.
