---
phase: 3
title: "Navigation scaffolding (additive)"
status: completed
priority: P1
dependencies: [2]
---

# Phase 3: Navigation scaffolding (additive)

## Overview

Build the complete React Navigation structure additively, alongside the still-live expo-router, without cutting over. This splits the original 35-file atomic commit (red-team F1) into a safe first step: navigators, typed param lists, linking config, and the two missing settings screens exist and compile but are not yet the app's router.

## Requirements

- Functional: root stack (auth vs authenticated after hydration), auth stack, bottom-tab navigator (six tabs), authenticated stack (all detail/editor/settings routes), a central linking config, and the two new screens (`notifications`, `account`) all exist and typecheck.
- Non-functional: all route params typed (entity IDs required strings; product create optional `barcode`/`qr`; deal editor optional `editId`; report validated target type+ID; email/reset routes accept only preceding-step values). No behavior cutover in this phase.

## Architecture

Create `src/navigation/` in parallel to `app/`:
- **Root stack** — decides auth vs authenticated tree after session hydration.
- **Auth stack** — Welcome, Sign in, Sign up, Verify email, Forgot password, Verify reset code, Reset password.
- **Tab navigator** — Home, Giveaways, Deals, Browse, Reviews, Profile.
- **Authenticated stack** — Scan; product detail/review/create; record detail; deal detail/editor; giveaway detail/manage/rate/mine/create; household; invite; report; settings; appearance; passkey; notification settings; account settings.
- **Typed param lists** for every stack.
- **Central linking config** mapping supported URLs to screens/params (wiring/cutover in phase 5).

**New screens (close today's broken links — `settings/index.tsx` links `/(app)/settings/notifications` + `.../account`, which don't exist):** `settings/notifications` (permission state + native system-settings action) and `settings/account` (identity details, passkey entry, sign-out). No new backend behavior.

This phase writes navigator components that import the existing route *screens*' presentational content where practical, but does not remove expo-router. Ports happen in phase 4.

**Referral code is untrusted input (red-team-2 F7):** `Expyrico://invite?code=...` is a custom-scheme link that any app or webpage on the device can fire (unlike verified App Links / Universal Links, there is no origin check). The linking config designed here must only *capture* the `code`; all effect (referral attribution, household join) is deferred to an authenticated, server-validated, idempotent action — never auto-applied on cold start. Validation is trust-status validation on the server, not just URL-shape validation on the client. Consider verified App Links / Universal Links in addition to the custom scheme so origin can be trusted; that domain-verification work is out of scope here but the handler must not auto-act on the untrusted payload.

## Related Code Files

- Create: `src/navigation/` (root/auth/tab/authenticated navigators, param-list types, linking config)
- Create: `src/navigation/screens/settings-notifications.tsx`, `src/navigation/screens/settings-account.tsx` (or equivalent under the new tree)
- Reference (not yet modified): `app/**` expo-router tree stays live

## Implementation Steps

1. Define typed param lists for all four navigators.
2. Build the navigators against the phase-2 React Navigation packages; wire the root auth/authenticated decision to the existing session-hydration state.
3. Author the central linking config (registered but not yet the app's linker).
4. Implement `settings/notifications` and `settings/account` screens.
5. Typecheck the new tree in isolation; add unit tests for param typing and the auth/authenticated decision.

## Success Criteria

- [ ] `src/navigation/` compiles; all navigators + typed param lists exist; expo-router still runs the app (no cutover yet).
- [ ] `notifications` and `account` screens exist and render in isolation.
- [ ] Param-list types enforce the documented constraints; navigation unit tests pass; typecheck + lint pass.
- [ ] **(red-team-2 F7)** the linking handler only captures the referral `code`; no state change happens on cold start before an authenticated, server-validated, idempotent action. A hostile-invite-payload test confirms no auto-join/auto-attribution.

## Risk Assessment

- Scaffolding drifting from real screen behavior → keep navigators thin; actual screen ports are phase 4.
- Duplicate maintenance while both routers exist → time-box phases 3–5 tightly so the dual-router window is short.
