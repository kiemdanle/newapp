---
title: Plan Mobile Pantry Grid Card Swipe Action Drawer
date: 2026-09-07
summary: "Created a 5-phase plan to port the swipe-to-reveal quick action menu to the 2-column Grid View using an In-Place Full-Surface Action Drawer with horizontal gesture detection, single-drawer mutual exclusivity, and SectionList scroll coordination."
---

# Plan: Mobile Pantry Grid Card Swipe Action Drawer

Created technical implementation plan `plans/260907-1204-mobile-pantry-grid-swipe-action-drawer/plan.md` to bring quick swipe actions to the 2-column Grid View without the layout squishing or touch-target crowding of side strips.

### Architectural Solution: Approach 2 (In-Place Action Drawer)
- **Problem**: 2-column grid cards are $\sim 160\text{ pt}$ wide; squeezing a $180\text{ pt}$ 3-button side strip causes card distortion and touch-boundary collisions.
- **Solution**: A full-surface **Action Drawer** (`PantryGridActionDrawer`) sits beneath the front card. Swiping left $> 45\text{ pt}$ slides the front surface away, revealing full-width $\ge 40\text{ pt}$ touch-target buttons (`+1 Quantity`, `Edit`, `Delete`) and a dismiss header `[✕]`.
- **Coordination**: Single active drawer mutual exclusivity managed in `RecordList.tsx` (`activeDrawerId`), auto-closing on `SectionList` vertical scroll.
- **Gesture Isolation**: `failOffsetY: [-10, 10]` guarantees vertical scrolling takes priority; `enabled={!selectionMode}` disables gestures in bulk selection mode.

### 5 Phased Milestones
1. **Phase 1**: Action Drawer Layout & Styling (`PantryGridActionDrawer.tsx` & tests).
2. **Phase 2**: Swipe Gesture & State Machine (`PantryGridCard.tsx` pan gesture, threshold snap).
3. **Phase 3**: RecordList Callback Wiring (wire `onAddQuantity`, `onEdit`, `onDelete` to grid slots).
4. **Phase 4**: Scroll Coordination & Selection Guard (`activeDrawerId` state, scroll reset).
5. **Phase 5**: Integration Tests & On-Device Verification (Jest suites, Gradle `:app:assembleDebug`, ADB test on Xiaomi Mi 9).
