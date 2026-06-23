---
phase: 1
title: "Implement rename"
status: completed
priority: P1
effort: "15m"
dependencies: []
---

# Phase 01: Implement "Pantry" → "Expyrico" rename

## Overview

Replace user-visible "Pantry" / "Pantry Admin" strings with "Expyrico" / "Expyrico Admin" across admin UI and backend user-facing text. Internal identifiers (cookie names, package scope, user-agent) unchanged.

## Requirements
- Functional: All admin page titles, headers, and metadata show "Expyrico Admin"
- Functional: Backend email subjects show "Expyrico" instead of "Pantry"
- Functional: Push notification title shows "Expyrico"
- Functional: TOTP issuer shows "Expyrico Admin"
- Non-functional: No session invalidation (cookie names unchanged)
- Non-functional: Tests still pass

## Architecture

Simple string replacement — no logic or architectural changes.

## Related Code Files
- Modify: `apps/admin/src/app/layout.tsx`
- Modify: `apps/admin/src/app/login/page.tsx`
- Modify: `apps/admin/src/components/header.tsx`
- Modify: `api/src/services/auth/totp.ts`
- Modify: `api/src/services/auth/email.ts`
- Modify: `api/src/workers/notification-send.ts`

## Implementation Steps

1. Edit `apps/admin/src/app/layout.tsx` — change `title: 'Pantry Admin'` to `title: 'Expyrico Admin'`, change `description` similarly
2. Edit `apps/admin/src/app/login/page.tsx` — change `<h1>Pantry Admin</h1>` to `<h1>Expyrico Admin</h1>`
3. Edit `apps/admin/src/components/header.tsx` — change `Pantry Admin` to `Expyrico Admin`
4. Edit `api/src/services/auth/totp.ts` — change TOTP issuer `'Pantry Admin'` to `'Expyrico Admin'`
5. Edit `api/src/services/auth/email.ts` — change email subjects from "Pantry" to "Expyrico"
6. Edit `api/src/workers/notification-send.ts` — change push title `'Pantry'` to `'Expyrico'`
7. Run compile check: `pnpm -r typecheck` or equivalent
8. Run admin unit tests

## Success Criteria
- [x] All 8 strings changed per the spec
- [x] Admin builds and typechecks
- [x] Admin unit tests pass
- [x] Cookie names unchanged (verify via grep)

## Risk Assessment

Negligible risk. String-only changes with exact before/after pairs. Cookie names untouched = no session impact.
