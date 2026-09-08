---
title: Plan Mobile Pantry Grid View and View Switch Toggle
date: 2026-09-07
summary: "Created comprehensive 5-phase plan adding a 2-column grid view to mobile pantry with toolbar toggle button, AsyncStorage persistence, and single stable SectionList architecture."
---

# Plan Mobile Pantry Grid View and View Switch Toggle

Created implementation plan to add an interactive 2-column Grid View to the mobile pantry screen alongside the default List View:

1. **Phase 1: UI Preferences View Mode Store**: Extend `useUiPreferencesStore` with `pantryViewMode: 'list' | 'grid'` and AsyncStorage persistence under `@expyrico_pantry_view_mode`.
2. **Phase 2: Search Bar View Toggle Button**: Add an accessible 44×44pt view mode switch button beside the filter toggle in `PantrySearchBar.tsx` with dynamic `grid-outline` / `list-outline` icons.
3. **Phase 3: Pantry Grid Card Component**: Create `PantryGridCard.tsx` featuring product thumbnail, status badge, 2-line title, and bulk-selection support using Expyrico design tokens.
4. **Phase 4: RecordList Grid Integration**: Implement 2-column tuple chunking within `RecordList.tsx` preserving the single stable `SectionList`, section headers, pagination, and search focus.
5. **Phase 5: Integration Tests & Verification**: Comprehensive unit/integration tests and on-device ADB verification.

Plan location: `plans/260907-1117-mobile-pantry-grid-view-toggle/`
Status: Validated and active via `ak plan use`.
