---
phase: 5
title: "Navigation atomic flip and deep-link cutover"
status: pending
priority: P1
dependencies: [4]
---

# Phase 5: Navigation atomic flip and deep-link cutover

## Overview

The single small atomic commit that makes React Navigation the app's router and removes the expo-router filesystem layouts. All screens were ported in phase 4, so this flip is small and reviewable — the opposite of the original 35-file mega-commit (red-team F1).

## Requirements

- Functional: the app boots on React Navigation; the `app/` filesystem-router layouts are gone; deep linking is served by the phase-3 linking config; Android back pops the stack, exits at root, tabs stay mounted.
- Non-functional: the canonical URL scheme is `Expyrico` (capitalized — validation decision 2026-07-14: keep the currently-registered `app.config.ts` scheme rather than changing native registration), pinned once and registered identically across the linking config `prefixes`, Android intent filter, and iOS `CFBundleURLSchemes`. <!-- Updated: Validation Session 1 - keep capitalized Expyrico scheme -->

## Architecture

The entrypoint change that makes React Navigation authoritative lands here (the AppRegistry entry itself is phase 9/11 work, but the router swap is this commit). Remove `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, and any remaining filesystem-router glue.

**Deep-link cutover (red-team F-typed-routes, F2-assumption):** the current `app/_layout.tsx:140-146` does a manual `Linking.addEventListener('url', …)` + `Linking.parse` for invite capture, independent of the router. Decide explicitly whether invite capture uses React Navigation's `linking.subscribe`/`getInitialURL` or a retained manual `Linking` listener, and preserve BOTH cold-start and warm-app capture (both are acceptance items). Only `Expyrico://invite?code=...` is an advertised app-owned content link; the Google OAuth callback scheme and passkey associated-domains are handled in phases 9/10 and must not be broken by this linking config.

The canonical scheme string is `Expyrico` (the value already in `app.config.ts:7`, kept per validation to avoid changing native registration). Register it identically in the React Navigation linking `prefixes` (`Expyrico://`), the Android intent filter, and iOS `CFBundleURLSchemes` — schemes are case-insensitive per RFC but React Navigation prefix matching is a string compare, so the native manifest/Info.plist value must match the config exactly.

## Related Code Files

- Modify: app entry to mount the React Navigation container + linking config
- Delete: `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, remaining `app/` router glue
- Modify: referral capture wiring (`src/referral/pendingReferralStore.ts` consumers) for cold-start + warm-app

## Implementation Steps

1. Mount the React Navigation container as the app root; attach the linking config.
2. Pin the canonical scheme casing; ensure the linking `prefixes` matches what phases 9/10 will register natively.
3. Implement invite capture for both cold start (`getInitialURL`) and warm app (`linking.subscribe` or retained listener); preserve the existing validate-and-capture behavior.
4. Delete the expo-router layouts and glue in the same commit.
5. Verify Android back behavior; run the full route/linking/auth-redirect test suite.

## Success Criteria

- [ ] App boots on React Navigation; no `expo-router` layout or import remains in `app/` or `src`.
- [ ] `Expyrico://invite?code=...` validated + captured on BOTH cold start and warm app; the canonical `Expyrico` casing is registered identically in the linking config, Android intent filter, and iOS `CFBundleURLSchemes`.
- [ ] Android back pops stack / exits at root / tabs stay mounted; full route + linking + auth-redirect tests pass; typecheck + lint pass.

## Risk Assessment

- Warm-app vs cold-start capture semantics differ between manual listener and `linking.subscribe` (red-team) → explicit tests for both paths.
- Scheme-casing mismatch across config/native → pin once, register identically, test on both platforms (native registration in phases 9/10).
- Flip regressions → this is the rollback point; keep the commit isolated so revert restores expo-router cleanly if needed.
