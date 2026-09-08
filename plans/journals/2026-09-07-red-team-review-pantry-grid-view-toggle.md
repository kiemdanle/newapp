---
title: Red Team Review Mobile Pantry Grid View and View Switch Toggle
date: 2026-09-07
summary: "Completed adversarial red-team review with 3 hostile personas (Security Adversary, Failure Mode Analyst, Assumption Destroyer), adjudicating 14 findings down to 7 accepted critical/high architectural protections."
---

# Red Team Review: Mobile Pantry Grid View and View Switch Toggle

Conducted adversarial red-team review of `plans/260907-1117-mobile-pantry-grid-view-toggle/` across 3 parallel hostile reviewers:

1. **Failure Mode Analyst**: Flagged pagination phantom-append on view mode toggle (50% content height shrink triggering `onEndReached`), SectionList chunked tuple key collisions, and scroll offset assumptions.
2. **Security Adversary**: Flagged backend schema mismatch on `PATCH /me/preferences`, lack of logout cleanup for `@expyrico_pantry_view_mode`, missing household badge classifier gate, and unconfirmed bulk mutations.
3. **Assumption Destroyer**: Flagged 360pt responsive metadata truncation, In-Stock vs History tab scope mismatch, urgent header item count halving, and Expyrico dark token compliance.

### Accepted Architectural Protections
- **Pagination Guard**: Reset `onEndReachedCalledDuringMomentumRef.current = true` on view mode toggle.
- **SectionList Invariant Preservation**: Composite row keys `${item[0].id}:${item[1]?.id ?? 'empty'}`, `extraData={{ viewMode, selectionMode, selectedIds }}`, and `renderSectionHeader` reads `originalCount ?? section.data.length`.
- **Local Device Preference**: Keep `pantryViewMode` in AsyncStorage without throwing 400s against strict backend schemas, and clean up on sign-out.
- **Privacy & Badge Parity**: Exact `RecordCard` classifier gate for household badges, and privacy field allowlist on grid tiles.
- **Scope Clarification**: Grid view is for In Stock pantry inventory only; History tab remains a 1-column audit log.
- **Responsive Wrap & Dark Tokens**: Wrap footer metadata for 360pt screens and bind 100% to Expyrico dynamic tokens.

Whole-plan consistency sweep confirmed 0 contradictions and valid plan format.
