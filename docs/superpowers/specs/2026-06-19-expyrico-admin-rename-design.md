# Expyrico Admin Rename — Design Spec

**Date:** 2026-06-19
**Context:** Revert user-visible "Pantry"/"Pantry Admin" branding in the admin interface + backend user-facing strings to "Expyrico" / "Expyrico Admin".

## Scope

User-visible strings only. No internal identifiers changed.

### Changed

| File | Current | New |
|------|---------|-----|
| `apps/admin/src/app/layout.tsx:6` | `title: 'Pantry Admin'` | `title: 'Expyrico Admin'` |
| `apps/admin/src/app/layout.tsx:7` | `description: 'Pantry administration dashboard'` | `description: 'Expyrico administration dashboard'` |
| `apps/admin/src/app/login/page.tsx:10` | `<h1>Pantry Admin</h1>` | `<h1>Expyrico Admin</h1>` |
| `apps/admin/src/components/header.tsx:5` | `Pantry Admin` | `Expyrico Admin` |
| `api/src/services/auth/totp.ts:19` | `'Pantry Admin'` (issuer) | `'Expyrico Admin'` |
| `api/src/services/auth/email.ts:30` | `'Verify your Pantry email'` | `'Verify your Expyrico email'` |
| `api/src/services/auth/email.ts:46` | `'Reset your Pantry password'` | `'Reset your Expyrico password'` |
| `api/src/workers/notification-send.ts:35` | `title: 'Pantry'` | `title: 'Expyrico'` |

### NOT changed

- Cookie names (`pantry_admin_access`, `pantry_admin_refresh`, `pantry_admin_csrf`) — keeps sessions alive
- User-agent string `PantryApp/1.0` — machine identifier
- Test fixture emails (`@pantry.local`) — internal test plumbing
- Mobile app — outside scope ("admin interface" only)
- Package scope `@pantry/*`, DB names, theme ids — code identifiers

## Test impact

- `apps/admin/tests/unit/cookies.test.ts` asserts cookie name constants — no change needed (we're not touching them)
- No other tests assert the specific display strings being changed

## Risk

Negligible. String-only changes. No logic, no auth, no session impact.
