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

---

## Requirements

### Functional Requirements
1. **Escape Hatch on Unavailable Screen**:
   - In `apps/mobile/app/(app)/scan.tsx`, when `ui.phase === 'unavailable'`, add an action button:
     `"Add as Private Item to My Pantry"`.
   - Tapping this button transitions the scanner to `ui.phase = 'under-review-custom-item'`, pre-filling the scanned barcode and allowing the user to name the item, set expiration, and save it locally immediately.
2. **Offline Local Record Resilience**:
   - Saving a private item with an uncached barcode persists the record locally in WatermelonDB SQLite with `pending_sync = true`, allowing seamless offline pantry tracking.

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
- Test: `apps/mobile/__tests__/scan.test.tsx`

---

## Implementation Steps

1. **Update `apps/mobile/app/(app)/scan.tsx`**:
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
             label="Add as Private Item to My Pantry"
             variant="outline"
             onPress={() => setUi({ phase: 'under-review-custom-item' })}
           />
         ) : null}
         <Button testID="scan-again" label="Scan again" variant="ghost" onPress={scanAgain} />
       </View>
     ) : null}
     ```

2. **Update Unit Tests in `apps/mobile/__tests__/scan.test.tsx`**:
   - Add test verifying that when lookup returns `unavailable`, the "Add as Private Item to My Pantry" button is rendered and transitions to the manual entry phase.

---

## Success Criteria
- [ ] The `unavailable` error card renders an "Add as Private Item to My Pantry" button.
- [ ] Users can proceed to save the item locally without waiting for external API recovery.
- [ ] All scanner unit tests in `apps/mobile/__tests__/scan.test.tsx` pass.
