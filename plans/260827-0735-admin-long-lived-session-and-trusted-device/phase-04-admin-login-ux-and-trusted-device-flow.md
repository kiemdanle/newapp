---
phase: 4
title: Admin Login UX and Trusted Device Flow
status: completed
priority: P1
dependencies:
  - 1
  - 2
  - 3
---

# Phase 4: Admin Login UX and Trusted Device Flow

## Overview
Connects the Next.js admin frontend to the backend trusted device engine. Integrates the `pantry_admin_trusted_device` cookie into `apps/admin/src/app/api/auth/login/route.ts` and `apps/admin/src/app/api/auth/totp/route.ts`, adds a default-checked "Trust this device for 60 days" checkbox to the TOTP verification screen, updates `finalizeSession` to persist trusted device cookies, adds an explicit "Log out" button to the Admin Header, and provides a self-service Trusted Devices management section in Admin Settings with CSRF-protected revocation.

## Requirements
### Functional
- **Route Handler: `apps/admin/src/app/api/auth/login/route.ts`**:
  - Read `COOKIE_NAMES.trustedDevice` from incoming request cookies (`cookieStore.get(COOKIE_NAMES.trustedDevice)?.value`).
  - Forward `trustedDeviceToken` in payload to Fastify `/v1/auth/login`.
  - If upstream returns full session `{ user, tokens }` (due to valid trusted device token):
    - Call `finalizeSession(body, env)` directly, setting cookies and returning `{ user }`.
    - **Bypasses TOTP challenge completely!**
  - If upstream returns `{ requiresTotp: true, challengeToken }`:
    - Return challenge token to client as normal.
- **Route Handler: `apps/admin/src/app/api/auth/totp/route.ts`**:
  - Accept `{ challengeToken, code, trustDevice?: boolean }`.
  - Forward payload to Fastify `/v1/auth/totp/challenge-verify`.
  - Pass upstream response to `finalizeSession`.
- **Session Finalization: `finalizeSession`**:
  - When `body.trustedDeviceToken` is present:
    - Append `Set-Cookie` for `COOKIE_NAMES.trustedDevice` with `maxAgeSec = 60 * 24 * 60 * 60` (60 days), `httpOnly: true`, `secure: env.cookieSecure`, `sameSite: 'lax'`, `path: '/'`.
  - Set `COOKIE_NAMES.access` (15m), `COOKIE_NAMES.refresh` (365d), and `COOKIE_NAMES.csrf` (365d).
- **TOTP Verification Screen (`apps/admin/src/app/login/totp-form.tsx`)**:
  - Add a styled checkbox input: **"Trust this device for 60 days"** (**default: checked** per interview decision).
  - Subtext: "You will not be asked for an authenticator code on this device for the next 60 days."
  - When submitting the 6-digit code, include `trustDevice: boolean` in `POST /api/auth/totp`.
- **Admin Header Logout Component (`apps/admin/src/components/header.tsx`)**:
  - Add a clear, accessible "Sign out" / "Log out" button or user dropdown menu next to the user email/initials.
  - On click, execute `POST /api/auth/logout` via browser client, clear client state, and redirect to `/login`.
  - Preserves the `pantry_admin_trusted_device` cookie so the admin can log in with password without OTP on the same device.
- **Self-Service Trusted Devices Management UI (`apps/admin/src/app/(admin)/settings/security/page.tsx` or `/settings/admins`)**:
  - Display active trusted devices table with IP, device name/browser, created date, last used date, and expires date.
  - Provide a "Revoke" button per device that triggers a CSRF-validated server action calling `DELETE /v1/admin/trusted-devices/:id`.

<!-- Updated: Red Team Review Session 1 - Enforced CSRF validation on trusted device deletion server action -->

### Non-Functional
- **Design Compliance**: Follow Expyrico color requirements (`#4BAE8A` Fresh Sage, `#3A8F6F` Deep Sage, `#2C2C28` Almost Black, `#8C8C85` Pebble, `#FAFAF8` Warm White) and design guidelines from `docs/design/expyrico-colour-palette.md`.
- **Accessibility (a11y)**: Proper label associations (`htmlFor`), focus rings, keyboard navigability, and ARIA attributes for form inputs and logout trigger.
- **Mobile Responsive**: Compatible with mobile drawer and desktop viewport widths.

## Architecture
```
+-------------------------------------------------------------------------------+
|                      Admin Web Login Flow with Trusted Device                 |
+-------------------------------------------------------------------------------+

[Admin enters Email & Password]
             |
[POST /api/auth/login] (attaches cookie: pantry_admin_trusted_device if present)
             |
[POST /v1/auth/login] (Fastify API)
             |
   +---------+---------+
   |                   |
[Device Trusted]   [Device Not Trusted]
   |                   |
[Returns Tokens]   [Returns { requiresTotp: true, challengeToken }]
   |                   |
[Redirect to /]    [Show TotpForm]
                       |
                   [Admin enters 6-digit code + Checkbox "Trust device for 60 days" (Default: Checked)]
                       |
                   [POST /api/auth/totp { challengeToken, code, trustDevice: true }]
                       |
                   [Fastify verifies code & issues trustedDeviceToken]
                       |
                   [Next.js sets cookie: pantry_admin_trusted_device (60 days)]
                   [Next.js sets cookies: access (15m), refresh (365d), csrf (365d)]
                       |
                   [Redirect to /]
```

## Related Code Files
- Modify: `apps/admin/src/app/api/auth/login/route.ts`
- Modify: `apps/admin/src/app/api/auth/totp/route.ts`
- Modify: `apps/admin/src/app/login/totp-form.tsx`
- Modify: `apps/admin/src/app/login/login-form.tsx`
- Modify: `apps/admin/src/components/header.tsx`
- Modify: `apps/admin/src/app/api/auth/logout/route.ts`
- Modify: `apps/admin/src/lib/admin-api.ts` (Add `serverAdminApi.trustedDevices.list` and `revoke`)
- Create: `apps/admin/src/app/(admin)/settings/security/page.tsx` (or update `settings/admins/page.tsx`)
- Modify: `apps/admin/tests/e2e/login.spec.ts`

## Implementation Steps
1. **Update `apps/admin/src/app/api/auth/login/route.ts`**:
   - Read `cookieStore.get(COOKIE_NAMES.trustedDevice)?.value`.
   - Forward `trustedDeviceToken` in upstream request body.
   - If upstream returns tokens directly (`body.tokens`), call `finalizeSession(body, env)`.
2. **Update `apps/admin/src/app/api/auth/totp/route.ts` & `finalizeSession`**:
   - Forward `trustDevice` to upstream.
   - In `finalizeSession`, if `body.trustedDeviceToken` is present, append `Set-Cookie` for `COOKIE_NAMES.trustedDevice` (60 days maxAge).
3. **Enhance `TotpForm` (`apps/admin/src/app/login/totp-form.tsx`)**:
   - Initialize `const [trustDevice, setTrustDevice] = useState(true);`.
   - Render styled checkbox with Label and description.
   - Send `trustDevice` in fetch payload to `/api/auth/totp`.
4. **Add Logout Action to `Header` (`apps/admin/src/components/header.tsx`)**:
   - Create a client-side logout component or button in header.
   - Triggers `POST /api/auth/logout` and redirects with `router.replace('/login')` and `router.refresh()`.
5. **Implement Trusted Devices Management UI**:
   - Add typed API methods in `apps/admin/src/lib/admin-api.ts`.
   - Build trusted devices table component with individual Revoke actions protected by CSRF verification.

## Success Criteria
- [ ] Login screen automatically bypasses TOTP when `pantry_admin_trusted_device` cookie is present and valid.
- [ ] TOTP form includes a default-checked "Trust this device for 60 days" checkbox.
- [ ] Submitting TOTP with the checkbox checked sets the `pantry_admin_trusted_device` cookie for 60 days.
- [ ] Header includes a functioning "Log out" button that destroys the session and redirects to `/login`.
- [ ] Admin Settings displays active trusted devices with individual revocation capability.

## Risk Assessment
- **Checkbox Confusion**: Ensure the checkbox copy is unambiguous and clearly explains the 60-day window.
- **Cookie Domain / Path Mismatch**: Cookies must be set with `Path=/` and matching `env.cookieDomain` so all admin subpaths receive them.
