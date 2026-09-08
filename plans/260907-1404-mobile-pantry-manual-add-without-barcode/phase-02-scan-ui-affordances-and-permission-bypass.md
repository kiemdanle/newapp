---
phase: 2
title: "Scan UI Affordances, Permission Bypass & Navigation"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Scan UI Affordances, Permission Bypass & Navigation

## Overview
Implement the `"Add without barcode"` button on `ScanScreen`, add manual entry fallbacks to camera permission modals, and connect the streamlined `manual-entry` phase to `AddRecordForm`.

## Requirements
- Functional:
  - In `ScanScreen` (`apps/mobile/app/(app)/scan.tsx`) during `ui.phase === 'scanning'`:
    - Display an elevated floating action pill/button at the bottom of the viewfinder with label `"Add without barcode"`, icon `create-outline`, and secondary microcopy `"Produce, bakery, wet market items"`.
    - Accessible touch target $\ge 48 \times 48\text{ pt}$ with `testID="scan-manual-add"`.
    - Tapping this button transitions `ScanScreen` to `{ phase: 'manual-entry' }`.
  - In `ScanUiState`:
    - Add phase `| { phase: 'manual-entry' }`.
    - When `ui.phase === 'manual-entry'`:
      - Top bar updates eyebrow to `"WITHOUT BARCODE"` and title to `"Add item"`.
      - Back button returns to `scanning` (or exits if user arrived directly).
      - Renders `KeyboardAwareScrollView` with `AddRecordForm(productId: null, onSaved: () => navigation.replace('Tabs'))`.
  - In `CameraPermissionDeniedModal` (`apps/mobile/src/features/scan/CameraPermissionDeniedModal.tsx`):
    - Add an explicit button: `"Add item without barcode"` (`testID="camera-denied-manual-add"`) so users without camera permissions are never blocked from adding items.
  - In `PrePromptModal` (`apps/mobile/src/features/scan/PrePromptModal.tsx`):
    - Add an option `"Add without camera"` (`testID="preprompt-manual-add"`).
  - In `HomeTab` (`apps/mobile/app/(app)/(tabs)/home.tsx`):
    - Update empty pantry card with a secondary CTA: `"Add without barcode"` navigating to `Scan` with `{ initialPhase: 'manual' }`.
  - In `AppStackParamList` (`apps/mobile/src/navigation/AppNavigator.tsx`):
    - Update `Scan: { target?: 'pantry' | 'deal'; initialPhase?: 'scanning' | 'manual' } | undefined`.
- Non-functional:
  - Adhere strictly to Expyrico palette tokens (Fresh Sage `#4BAE8A`, Warm White `#FAFAF8`, Honey `#F5A623`, Stone `#F0F0ED`, Almost Black `#2C2C28`).
  - Viewfinder button must remain visible and legible over arbitrary dark or bright camera feeds using an elevated background with border (`theme.colors.bgElevated`, `theme.colors.border`, and glass/subtle drop shadow).

## Architecture
```
User Paths to Manual Entry
1. Home Tab -> FAB "Scan an item" -> ScanScreen (viewfinder)
   └── Tap "Add without barcode" Floating Pill -> ui.phase = 'manual-entry'
2. Home Tab -> Empty State Card -> Tap "Add without barcode" -> ScanScreen(initialPhase: 'manual')
3. Camera Permission Denied Modal -> Tap "Add item without barcode" -> ui.phase = 'manual-entry'
4. Camera Pre-Prompt Modal -> Tap "Add without camera" -> ui.phase = 'manual-entry'

ScanScreen State Machine
┌─────────────────────────────────────────────────────────────┐
│                       ui.phase                              │
├──────────────┬──────────────┬───────────────────────────────┤
│ 'scanning'   │ Default      │ ScanCamera + Viewfinder Guide │
│              │              │ + "Add without barcode" Pill  │
├──────────────┼──────────────┼───────────────────────────────┤
│'manual-entry'│ User tapped  │ TopBar ("WITHOUT BARCODE")   │
│              │ manual add   │ + AddRecordForm (custom item) │
├──────────────┼──────────────┼───────────────────────────────┤
│ 'looking-up' │ Code scanned │ ActivityIndicator             │
├──────────────┼──────────────┼───────────────────────────────┤
│ 'not-found'  │ Miss in DB   │ "Add as Private Item"         │
└──────────────┴──────────────┴───────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/src/features/scan/CameraPermissionDeniedModal.tsx`
- Modify: `apps/mobile/src/features/scan/PrePromptModal.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`

## Implementation Steps
1. Update `AppStackParamList` in `AppNavigator.tsx`:
   - Add `initialPhase?: 'scanning' | 'manual'` to `Scan` route parameters.
2. In `scan.tsx`:
   - Extend `ScanUiState` with `| { phase: 'manual-entry' }`.
   - Initialize `ui` state checking `route.params?.initialPhase === 'manual' ? { phase: 'manual-entry' } : { phase: 'scanning' }`.
   - In `cameraContainer`, render the `"Add without barcode"` floating button anchored at the bottom:
     ```tsx
     <Pressable
       testID="scan-manual-add"
       accessibilityRole="button"
       accessibilityLabel="Add item without barcode"
       onPress={() => setUi({ phase: 'manual-entry' })}
       style={[styles.manualAddBtn, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}
     >
       <Ionicons name="create-outline" size={20} color={theme.colors.primaryDark} />
       <View style={styles.manualAddTextWrap}>
         <Text style={[styles.manualAddTitle, { color: theme.colors.text }]}>Add without barcode</Text>
         <Text style={[styles.manualAddSubtitle, { color: theme.colors.textMuted }]}>
           Produce, bakery, wet market items
         </Text>
       </View>
       <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
     </Pressable>
     ```
   - In the render tree, add handling for `ui.phase === 'manual-entry'`:
     - Render `topBar` with eyebrow `"WITHOUT BARCODE"` and title `"Add item"`.
     - Render `AddRecordForm` with `productId={null}`, `onSaved={() => navigation.replace('Tabs')}`.
3. Update `CameraPermissionDeniedModal.tsx`:
   - Add prop `onAddManually?: () => void`.
   - Render a secondary button: `"Add item without barcode"`.
4. Update `PrePromptModal.tsx`:
   - Add prop `onAddManually?: () => void`.
   - Render tertiary action: `"Add without camera"`.
5. Update `home.tsx`:
   - In `emptyCard`, add a secondary button `"Add without barcode"` that calls `navigation.navigate('Scan', { initialPhase: 'manual' })`.

## Success Criteria
- [ ] Floating `"Add without barcode"` button is visible on `ScanScreen` over the camera viewfinder.
- [ ] Tapping `"Add without barcode"` immediately displays the manual item entry form.
- [ ] Users who deny camera permission can tap `"Add item without barcode"` and successfully enter items.
- [ ] Empty pantry screen provides direct access to manual entry.
- [ ] Back button in manual entry returns to scanning or pantry without UI freezing or camera crashes.

## Risk Assessment
- Risk: Camera background resources might stay active when entering `manual-entry`.
  - Mitigation: `ScanCamera` unmounts when `ui.phase !== 'scanning'`, releasing camera hardware and avoiding background CPU/battery drain.
- Risk: Floating button might overlap Android navigation gestures or camera guide frame.
  - Mitigation: Position button with `paddingBottom: insets.bottom + 16` and ensure guide frame is centered with fixed margins.
