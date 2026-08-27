---
phase: 3
title: Admin Long-Lived Session and Seamless Refresh
status: completed
priority: P1
dependencies:
  - 1
  - 2
---

# Phase 3: Admin Long-Lived Session and Seamless Refresh

## Overview
Fixes the defect causing admin dashboard sessions to prematurely kick admins to `/login` after 15 minutes of inactivity. Implements an automatic token refresh handshake in Next.js middleware, extends refresh cookie lifespan to 365 days (sliding window), adds concurrent-safe 401 interception & retry with a promise singleton to the browser fetch client, coordinates sliding cookie expirations, and hardens error resilience against transient network/server glitches.

## Requirements
### Functional
- **Middleware Refresh Handshake (`apps/admin/src/middleware.ts`)**:
  - If `COOKIE_NAMES.access` is present: allow request to proceed (`NextResponse.next()`).
  - If `COOKIE_NAMES.access` is missing/expired BUT `COOKIE_NAMES.refresh` is present:
    - On protected routes (`!isPublicPage`): redirect to `/api/auth/refresh-redirect?next=${encodeURIComponent(pathname + search)}`.
    - On `/login` (`isPublicPage`): redirect to `/api/auth/refresh-redirect?next=/` (so authenticated admins aren't shown the login form when only their 15-minute access token expired).
  - If NEITHER `access` NOR `refresh` is present:
    - On protected routes: redirect to `/login?next=${encodeURIComponent(pathname + search)}`.
    - On `/login`: allow request to proceed.
- **Extended Cookie Durations (`apps/admin/src/lib/cookies.ts`)**:
  - Update `COOKIE_NAMES`: add `trustedDevice: 'pantry_admin_trusted_device'`.
  - Update `REFRESH_MAX_AGE_SEC`: change from 30 days (`60 * 60 * 24 * 30`) to 365 days (`60 * 60 * 24 * 365 = 31,536,000` seconds).
  - Add `TRUSTED_DEVICE_MAX_AGE_SEC = 60 * 60 * 24 * 60` (60 days = 5,184,000 seconds).
  - Ensure `COOKIE_NAMES.csrf` uses `REFRESH_MAX_AGE_SEC` (365 days).
- **Route Handler Cookie Coordination & Transient Error Resilience**:
  - In `apps/admin/src/app/api/auth/refresh-redirect/route.ts` and `apps/admin/src/app/api/auth/refresh/route.ts`:
    - Re-issue refresh cookie with updated 365-day expiration (`Max-Age=31536000`) on every successful refresh (synchronizing browser cookie with database sliding session window).
    - Differentiate failure modes:
      - If upstream returns `401 Unauthorized` or `403 Forbidden` (session revoked or expired): clear cookies and redirect to `/login`.
      - If upstream returns `5xx` or fetch throws a network exception: **DO NOT clear cookies**. Render an error/retry response to avoid logging out all active admins during transient API redeployments.
- **Logout Cookie Lifecycle (`apps/admin/src/app/api/auth/logout/route.ts`)**:
  - Clears `COOKIE_NAMES.access`, `COOKIE_NAMES.refresh`, and `COOKIE_NAMES.csrf`.
  - Intentionally preserves `COOKIE_NAMES.trustedDevice` so that the admin can log in with password without OTP on subsequent visits within 60 days.
- **Browser API Client 401 Interception with Promise Singleton (`apps/admin/src/lib/api-client.ts`)**:
  - Maintain an in-flight refresh promise singleton (`let refreshPromise: Promise<void> | null = null;`).
  - If a browser `fetch()` call receives a `401 Unauthorized`:
    - If `refreshPromise` is currently in flight, await the existing promise rather than firing a duplicate refresh call.
    - Otherwise, initiate `refreshPromise = apiBrowserFetch('/api/auth/refresh', { method: 'POST' })`.
    - Once resolved, retry the original request with the freshly set cookies.
    - If refresh fails, clear `refreshPromise` and redirect window to `/login`.

<!-- Updated: Red Team Review Session 1 - Added in-flight refresh singleton, 5xx error resilience in refresh-redirect, and sliding Max-Age synchronization -->

### Non-Functional
- **Zero Redirect Loops**: Safe redirect target sanitization (`safeNext()`) ensuring only valid same-origin paths are redirected to.
- **Server Component Cookie Isolation**: Adheres strictly to Next.js 15 rules forbidding cookie writes inside Server Component renders (delegating cookie writes exclusively to Route Handlers like `refresh-redirect`).
- **CSRF Defense**: All state-modifying requests continue carrying double-submit CSRF verification.

## Architecture
```
+---------------------------------------------------------------------------------------+
|                          Next.js Admin Middleware Request Flow                        |
+---------------------------------------------------------------------------------------+
                                            |
                                  [Incoming Request]
                                            |
                                 [Is Static / Public API?]
                                /                         \
                              Yes                          No
                              /                             \
                       [Allow Through]             [Has access cookie?]
                                                   /                  \
                                                 Yes                   No
                                                 /                      \
                                          [Allow Through]       [Has refresh cookie?]
                                                                /                   \
                                                              Yes                    No
                                                              /                       \
                                                  [Is on /login?]           [Is on /login?]
                                                  /             \           /             \
                                                Yes              No       Yes              No
                                                /                 \       /                 \
                                  [Redirect to              [Redirect to [Allow       [Redirect to
                                   refresh-redirect?next=/]  refresh-    Through]      /login?next=...]
                                                             redirect?
                                                             next=PATH]
```

## Related Code Files
- Modify: `apps/admin/src/lib/cookies.ts`
- Modify: `apps/admin/src/middleware.ts`
- Modify: `apps/admin/src/lib/api-client.ts`
- Modify: `apps/admin/src/app/api/auth/refresh-redirect/route.ts`
- Modify: `apps/admin/src/app/api/auth/refresh/route.ts`
- Modify: `apps/admin/src/app/api/auth/logout/route.ts`
- Modify: `apps/admin/src/lib/session.ts`
- Modify: `apps/admin/tests/unit/middleware.test.ts`
- Modify: `apps/admin/tests/unit/cookies.test.ts`

## Implementation Steps
1. **Update Cookie Constants**:
   - In `apps/admin/src/lib/cookies.ts`, update `COOKIE_NAMES` and add `REFRESH_MAX_AGE_SEC = 365 * 24 * 60 * 60` and `TRUSTED_DEVICE_MAX_AGE_SEC = 60 * 24 * 60 * 60`.
2. **Refactor Middleware**:
   - In `apps/admin/src/middleware.ts`, implement the 3-state cookie check (`hasAccess`, `hasRefresh`, `isPublicPage`).
   - Redirect to `refresh-redirect` when `!hasAccess && hasRefresh`.
3. **Enhance `api-client.ts` with Refresh Singleton**:
   - Implement `let refreshPromise: Promise<void> | null = null;`.
   - On 401 status, deduplicate refresh across concurrent calls and retry original request.
4. **Harden Refresh and Logout Routes**:
   - Ensure both `refresh/route.ts` and `refresh-redirect/route.ts` set the 365-day maxAge on `COOKIE_NAMES.refresh` and `COOKIE_NAMES.csrf`.
   - Differentiate 401/403 (clear cookies and redirect to `/login`) from 5xx/network errors (preserve cookies).
   - Ensure `logout/route.ts` preserves `COOKIE_NAMES.trustedDevice`.
5. **Update Unit Tests**:
   - Extend `apps/admin/tests/unit/middleware.test.ts` with tests for:
     - Access present -> allowed.
     - Access missing, refresh present on protected path -> redirects to `/api/auth/refresh-redirect?next=...`.
     - Access missing, refresh present on `/login` -> redirects to `/api/auth/refresh-redirect?next=/`.
     - Neither present on protected path -> redirects to `/login?next=...`.
     - Neither present on `/login` -> allowed.

## Success Criteria
- [ ] Admins with active sessions remain logged in past the 15-minute access token window without disruption.
- [ ] Multiple concurrent client-side API requests hitting 401 trigger only a single refresh request.
- [ ] Transient 502/503 errors during backend API restarts do not clear admin refresh cookies.
- [ ] Navigating to `/login` with an active refresh cookie redirects smoothly back to `/`.
- [ ] All middleware and cookie unit tests pass.

## Risk Assessment
- **Infinite Redirect Loops**: Prevented by `safeNext()` and having `refresh-redirect` redirect to `/login` immediately if upstream `/v1/auth/refresh` returns 401/403.
- **Race Conditions in Concurrent Refreshes**: Handled by client-side `refreshPromise` singleton and backend Redis rotation grace window (60 seconds).
