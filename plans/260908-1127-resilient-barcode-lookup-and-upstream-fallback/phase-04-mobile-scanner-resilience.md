---
phase: 4
title: "Mobile Scanner UI Resilience & Escape Hatches"
status: todo
priority: P2
effort: "3h"
dependencies: [2]
---

# Phase 4: Mobile Scanner UI Resilience & Escape Hatches

## Overview
Enhance the mobile scanner interface (`apps/mobile/app/(app)/scan.tsx`) with an immediate, non-blocking escape hatch so that even if upstream network connectivity or services fail, the user is never stranded on an error panel and can always add the scanned item directly to their pantry.
<!-- Updated: Red Team Review - Barcode preservation, 5s client timeout, and offline-first photo handling -->

---

## Requirements

### Functional Requirements
1. **Escape Hatch on Unavailable Screen**:
   - In `apps/mobile/app/(app)/scan.tsx`, when `ui.phase === 'unavailable'`, add an action button:
     `"Add to Pantry Manually"`.
   - Tapping this button transitions the scanner to `ui.phase = 'under-review-custom-item'`, pre-filling the scanned barcode and allowing the user to name the item, set expiration, and save it locally immediately.
2. **5-Second Client-Side Lookup Timeout & In-Flight Escape**:
   - In `scan.tsx`, apply a 5000ms timeout / AbortController to `lookup.mutateAsync` so hanging requests fail-fast to `unavailable` rather than trapping the user indefinitely.
   - In the `looking-up` loading phase, display a "Cancel & Enter Manually" button so users can bypass the network query at any time.
3. **Durable Barcode Preservation on Manual Entry**:
   - Pass `scannedBarcode={lastScanRef.current?.value}` from `scan.tsx` into `AddRecordForm` and into `createLocalRecord({ ..., barcode: scannedBarcode })`.
   - Persist `barcode` in the local SQLite record so offline items retain their barcode for future catalog reconciliation.
4. **Offline-First Photo Handling in AddRecordForm**:
   - In `AddRecordForm.tsx:121-160`, ensure local record creation and user-entered `customName` are never discarded or blocked if photo upload/draft creation fails during network degradation.
### Non-Functional Requirements
- Ensure button conforms to accessibility touch targets (`minHeight >= 44`).
- Maintain existing test coverage in `apps/mobile/__tests__/scan.test.tsx`.

---

## Architecture

```
                    User Scans Barcode
                           │
                           ▼
                  POST /products/lookup-v2
                           │
               Fails with 'unavailable'
               (e.g. Offline / Network Timeout)
                           │
                           ▼
            ┌────────────────────────────────────────┐
            │   "Lookup is temporarily unavailable"  │
            ├────────────────────────────────────────┤
            │ [ Retry ]                              │
            │ [ Add as Private Item to My Pantry ]   │ ◄── NEW ESCAPE HATCH
            │ [ Scan again ]                         │
            └──────────────────┬─────────────────────┘
                               │
                               ▼ User taps "Add as Private Item"
            ┌────────────────────────────────────────┐
            │   Manual Name & Expiry Input Form      │
            │   - Barcode preserved                  │
            │   - Saves to local SQLite immediately   │
            └────────────────────────────────────────┘
```

---

## Related Code Files
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/api/records.ts`
- Test: `apps/mobile/__tests__/scan.test.tsx`
---

## Implementation Steps

1. **Update `apps/mobile/app/(app)/scan.tsx`**:
   - Apply 5-second timeout on `lookup.mutateAsync` and provide in-flight escape:
     ```tsx
     {ui.phase === 'looking-up' ? (
       <View style={styles.loading}>
         <ActivityIndicator color={theme.colors.primary} />
         <Text style={[styles.instructionText, { color: theme.colors.text }]}>Looking up item...</Text>
         <Button
           testID="scan-cancel-to-manual"
           label="Cancel & Enter Manually"
           variant="ghost"
           onPress={() => setUi({ phase: 'manual-entry' })}
         />
       </View>
     ) : null}
     ```
   - Inside `ui.phase === 'unavailable'`, insert the escape hatch button:
     ```tsx
     {ui.phase === 'unavailable' ? (
       <View testID="scan-unavailable" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
         <View style={[styles.panelIconBadge, { backgroundColor: theme.colors.accentLight }]}>
           <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.accent} />
         </View>
         <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Lookup is temporarily unavailable</Text>
         <Text style={[styles.panelBody, { color: theme.colors.textMuted }]}>This isn't a "not found" — please check your connection and try again.</Text>
         <Button testID="scan-retry" label="Retry" onPress={retry} />
         {target !== 'deal' ? (
           <Button
             testID="scan-add-custom-from-unavailable"
             label="Add to Pantry Manually"
             variant="outline"
             onPress={() => setUi({ phase: 'under-review-custom-item' })}
           />
         ) : null}
         <Button testID="scan-again" label="Scan again" variant="ghost" onPress={scanAgain} />
       </View>
     ) : null}
     ```
   - In `under-review-custom-item`, pass `scannedBarcode={lastScanRef.current?.value}` to `AddRecordForm`.

2. **Update `apps/mobile/src/features/records/AddRecordForm.tsx`**:
   - Accept `scannedBarcode?: string` in `Props`.
   - Pass `barcode: scannedBarcode` to `createLocalRecord`.
   - Ensure local SQLite record creation succeeds before or independent of deferred photo upload.

2. **Update Unit Tests in `apps/mobile/__tests__/scan.test.tsx`**:
   - Add test verifying that when lookup returns `unavailable`, the "Add as Private Item to My Pantry" button is rendered and transitions to the manual entry phase.

---

## Success Criteria
- [ ] The `unavailable` error card renders an "Add to Pantry Manually" button.
- [ ] In-flight `looking-up` phase renders a "Cancel & Enter Manually" escape hatch.
- [ ] Scanned barcode is preserved in the local record when adding manually.
- [ ] Users can proceed to save the item locally without waiting for external API recovery.
- [ ] All scanner unit tests in `apps/mobile/__tests__/scan.test.tsx` pass.
