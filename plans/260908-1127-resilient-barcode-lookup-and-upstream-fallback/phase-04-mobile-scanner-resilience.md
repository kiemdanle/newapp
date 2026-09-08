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
<!-- Updated: Red Team Review - Lookup generation invalidation & AbortSignal transport wiring -->

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
3. **Lookup Generation Invalidation & Stale Continuation Guard**:
   - Maintain a monotonic generation ref (`lookupGenerationRef = useRef(0)`) and an active abort controller ref (`activeAbortControllerRef = useRef<AbortController | null>(null)`).
   - On starting `runLookup`: increment `lookupGenerationRef.current += 1`, abort previous controller, and create a fresh `AbortController` passed to `apiClient.post(..., { signal })`.
   - When user taps "Cancel & Enter Manually" or the screen unmounts: increment `lookupGenerationRef.current += 1`, abort the in-flight controller, and set `ui.phase = 'manual-entry'`.
   - In `runLookup`, guard **both** the `try` block (success) and `catch` block (error):
     `if (lookupGenerationRef.current !== currentGen) return;`
     This guarantees that late-settling responses from aborted, timed-out, or cancelled lookups are dropped silently and **never** overwrite the UI or call `navigation.replace` while the user is actively entering item details.
4. **Durable Barcode Preservation on Manual Entry**:
   - Pass `scannedBarcode={lastScanRef.current?.value}` from `scan.tsx` into `AddRecordForm` and into `createLocalRecord({ ..., barcode: scannedBarcode })`.
   - Persist `barcode` in the local SQLite record so offline items retain their barcode for future catalog reconciliation.
5. **Offline-First Photo Handling in AddRecordForm**:
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
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/api/products.ts`
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/api/records.ts`
- Test: `apps/mobile/__tests__/scan.test.tsx`

## Implementation Steps

1. **Wire AbortSignal in `apps/mobile/src/api/client.ts` & `products.ts`**:
   - In `client.ts`: Add `signal?: AbortSignal` to `ApiClientOpts` and `ApiRequest`; pass `signal: req.signal` to `fetch(url, { ..., signal: req.signal })`.
   - In `products.ts`: Update `useProductLookupV2` mutationFn to accept `signal?: AbortSignal` and forward it to `apiClient.post`.

2. **Implement Generation Invalidation & Cancel Handler in `apps/mobile/app/(app)/scan.tsx`**:
   - Add `lookupGenerationRef` and `activeAbortControllerRef`:
     ```typescript
     const lookupGenerationRef = useRef(0);
     const activeAbortControllerRef = useRef<AbortController | null>(null);

     const cancelLookup = useCallback(() => {
       lookupGenerationRef.current += 1;
       activeAbortControllerRef.current?.abort();
       activeAbortControllerRef.current = null;
       setUi({ phase: 'manual-entry' });
     }, []);
     ```
   - In `runLookup`:
     ```typescript
     lookupGenerationRef.current += 1;
     const currentGen = lookupGenerationRef.current;
     activeAbortControllerRef.current?.abort();
     const controller = new AbortController();
     activeAbortControllerRef.current = controller;
     const timeoutId = setTimeout(() => controller.abort(), 5000);

     try {
       const result = await lookup.mutateAsync({
         ...(scan.kind === 'barcode' ? { barcode: scan.value } : { qr: scan.value }),
         signal: controller.signal,
       });
       clearTimeout(timeoutId);
       if (lookupGenerationRef.current !== currentGen) return; // Stale: drop silently
       // ... outcome switch statement ...
     } catch {
       clearTimeout(timeoutId);
       if (lookupGenerationRef.current !== currentGen) return; // Stale: drop silently
       setUi({ phase: 'unavailable' });
     } finally {
       if (lookupGenerationRef.current === currentGen) {
         lookupInFlightRef.current = false;
       }
     }
     ```
   - In `looking-up` phase, render the cancel button:
     ```tsx
     {ui.phase === 'looking-up' ? (
       <View style={styles.loading}>
         <ActivityIndicator color={theme.colors.primary} />
         <Text style={[styles.instructionText, { color: theme.colors.text }]}>Looking up item...</Text>
         <Button
           testID="scan-cancel-to-manual"
           label="Cancel & Enter Manually"
           variant="ghost"
           onPress={cancelLookup}
         />
       </View>
     ) : null}
     ```
   - In `under-review-custom-item`, pass `scannedBarcode={lastScanRef.current?.value}` to `AddRecordForm`.

3. **Update `apps/mobile/src/features/records/AddRecordForm.tsx`**:
   - Accept `scannedBarcode?: string` in `Props`.
   - Pass `barcode: scannedBarcode` to `createLocalRecord`.
   - Ensure local SQLite record creation succeeds before or independent of deferred photo upload.

4. **Update Unit Tests in `apps/mobile/__tests__/scan.test.tsx`**:
   - Add test: Cancel during in-flight lookup transitions to manual entry.
   - Add test: Late-settling network response (success or failure) after cancel is dropped and leaves the manual entry form intact without calling `navigation.replace`.

---

## Success Criteria
- [ ] The `unavailable` error card renders an "Add to Pantry Manually" button.
- [ ] In-flight `looking-up` phase renders a "Cancel & Enter Manually" escape hatch.
- [ ] Monotonic generation counter invalidates stale in-flight lookups so late responses never tear down the manual form.
- [ ] `AbortSignal` is wired through `apiClient` to cancel in-flight HTTP fetch calls on cancel/timeout.
- [ ] Scanned barcode is preserved in the local record when adding manually.
- [ ] All scanner unit tests in `apps/mobile/__tests__/scan.test.tsx` pass.
