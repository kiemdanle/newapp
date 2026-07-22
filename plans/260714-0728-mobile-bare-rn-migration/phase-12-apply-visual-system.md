---
phase: 12
title: "Apply Expyrico visual system (batched)"
status: completed
priority: P2
dependencies: [11]
---

# Phase 12: Apply Expyrico visual system (batched)

## Overview

Apply the single Expyrico visual system to every route on the final React Navigation tree of a build with no Expo. The original plan restyled 53 files (31 routes + 22 feature) under one unbounded gate (red-team F12); this phase promotes the consistency spec's four batches into gated sub-steps, each independently reviewable and testable. Palette/semantics unchanged.

## Requirements

- Functional: every route uses one shell, one card/list language, one icon-led tab treatment; no user-facing Bento/Clay/Material/Glass variant remains (deleted in phase 1). System follows device scheme; Light/Dark are manual overrides.
- Non-functional: 48dp min tap targets, 8dp min separation, visible pressed/disabled states, accessibility labels, keyboard-safe forms, branded empty/error/loading states. Honey = single primary action per screen + expiring-soon; Alert Red = expired/destructive only. Each batch gated by lint + typecheck + its tests before the next.

## Architecture

Restyle by family using the phase-1 primitives (`Screen`, buttons, inputs, cards/rows, tab pill, state surfaces). Each batch is a separate reviewable step with its own gate:

- **Batch A — Authentication:** welcome, sign-in, sign-up, forgot/reset, both OTP routes. Shared brand header, form rhythm, action hierarchy, recovery controls. OTP: six 48dp+ cells, time notice, one Honey verify, outlined resend, tertiary change-email; errors preserve input adjacent to the control.
- **Batch B — Pantry/product:** home (Use-next hero, expiry-priority list, thumb-zone scan), browse, record/product detail, new product, scan, reviews. Reuse shared cards/rows/fields/badges/empty states. (`UseNextHero.tsx`, `RecordCard.tsx` align to final primitives.)
- **Batch C — Community:** deals, giveaways, claims, ratings, invites, reports. Shared feed cards, action hierarchy, voting/status treatments, feedback states. (`DealCard/Feed/Form`, `GiveawayCard/Feed/StatusBadge`, `ClaimList`.)
- **Batch D — Account:** profile, household, settings, passkeys, appearance (the phase-1 three-option control). Grouped settings rows, shared confirmation/error surfaces.

Presentation-only: navigation (phases 3–5) and feature logic (phases 6–8) are untouched.

## Related Code Files

- Modify (Batch A): auth screens + OTP controls
- Modify (Batch B): `src/features/records/*`, `src/features/scan/*`, home/browse/review screens
- Modify (Batch C): `src/features/deals/*`, `src/features/giveaways/*`, `src/features/referral/*`, report, `src/features/households/*`
- Modify (Batch D): profile, `settings/*` (incl. phase-3 notifications/account), appearance control
- Modify: snapshot tests for deliberate visual changes only

## Implementation Steps

1. Batch A → verify control states + error-preserving behavior; gate (lint + typecheck + auth/OTP tests).
2. Batch B → verify hero, expiry list, scan thumb-zone; gate.
3. Batch C → verify feed cards + action hierarchy; gate.
4. Batch D → verify grouped rows + shared Appearance control; gate.
5. Refresh affected snapshots for intended changes only.

## Success Criteria

- [ ] Every route renders under one shell/card/tab language; no user-facing alternate visual variant.
- [ ] Honey only for the single primary action + expiring-soon; Alert Red only for expired/destructive; palette unchanged.
- [ ] 48dp actions, 8dp separation, accessibility labels, keyboard-safe forms, branded empty/error/loading verified.
- [ ] Per-batch: theme resolution/override, primary control states, OTP behavior, tab accessibility tests pass; snapshots updated only for intended changes; lint + typecheck pass.

## Risk Assessment

- Restyle drifting into behavior changes → presentation-only; keep navigation/feature logic untouched.
- One giant unreviewable diff (F12) → four gated batches, each merged/verified before the next.
- Snapshot noise hiding regressions → update only for deliberate changes; review each diff.
