---
phase: 4
title: "Navigation route ports (batched)"
status: pending
priority: P1
dependencies: [3]
---

# Phase 4: Navigation route ports (batched)

## Overview

Port the 31 route components off `expo-router` hooks/props onto the phase-3 React Navigation navigators, in reviewable batches by screen family. The app still boots on expo-router until phase 5; ports are staged so each batch is independently reviewable (red-team F1: the original single 35-file commit was unreviewable).

## Requirements

- Functional: every route component uses React Navigation hooks (`useNavigation`, `useRoute`, typed params) instead of `useRouter`/`useLocalSearchParams`/`Href`/`Link`. Feature logic unchanged.
- Non-functional: typed params enforced; `experiments.typedRoutes` (`app.config.ts:69`) consumers migrated to the new typed param lists (red-team F-typed-routes); each batch typechecks independently.

## Architecture

Batch by family so each is a small PR-sized change:
1. **Auth batch** — welcome, sign-in, sign-up, verify-email, forgot-password, verify-reset-code, reset-password.
2. **Tabs batch** — home, giveaways, deals, browse, reviews, profile.
3. **Pantry/product batch** — scan, product/[id], product/[id]/review, product/new, record/[id].
4. **Community batch** — deal/[id], deal/new, giveaway/[id], giveaway/[id]/manage, giveaway/[id]/rate, giveaway/mine, giveaway/new, invite, report/index.
5. **Account batch** — household/index, settings/index, settings/theme, settings/add-passkey, + the phase-3 notifications/account screens.

Each ported screen swaps navigation imports and reads params from the typed route; `href` string pushes become typed `navigate(name, params)`. Convert `expo-router` `Href` types to the phase-3 param lists. Do NOT delete the `app/` layouts yet — that is the phase-5 flip.

## Related Code Files

- Modify: all 31 route components under `apps/mobile/app/**` (navigation imports/params only)
- Modify: components consuming generated `Href` types → typed param lists from `src/navigation/`
- Modify/Create: per-batch route tests

## Implementation Steps

1. Port auth batch; typecheck + run auth route tests.
2. Port tabs batch; verify tab param typing.
3. Port pantry/product batch.
4. Port community batch.
5. Port account batch (incl. new screens from phase 3).
6. After each batch: typecheck + lint + that family's route tests. Keep expo-router live throughout.

## Success Criteria

- [ ] All 31 route components use React Navigation APIs; no component still calls `useRouter`/`useLocalSearchParams`/`Href`/`Link` from `expo-router`.
- [ ] Typed params compile against the phase-3 param lists; `typedRoutes` consumers migrated.
- [ ] Per-batch route tests pass; app still boots on expo-router (flip is phase 5).

## Risk Assessment

- A batch leaving a screen half-ported → each batch is self-contained and typechecked before the next.
- Typed-routes removal surprising consumers → migrate `Href` consumers within the owning batch, not deferred.
- Long dual-router window → batches are sequential but small; move straight to phase 5 once the last batch lands.
