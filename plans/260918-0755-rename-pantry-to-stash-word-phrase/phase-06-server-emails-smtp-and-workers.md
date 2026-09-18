---
phase: 6
title: "Server Emails, SMTP & System Workers"
status: pending
priority: P2
effort: "30m"
dependencies: [5]
---

# Phase 6: Server Emails, SMTP & System Workers

## Overview

Update email templates sent by the backend for household sharing, default SMTP environment configurations, and background worker notification comments from "Pantry" to "Stash".

## Requirements

### Functional Requirements
- **Household Invitation & Confirmation Emails (`api/src/services/households/invitation-email.ts`)**:
  - Invitation email subject: `${params.inviterName} invited you to join ${params.householdName} on Expyrico`.
  - Invitation card heading: `'Shared Stash Invitation'` (was `'Shared Pantry Invitation'`).
  - Invitation body description: `"Joining lets you share grocery tracking, collaborate on stashes, and receive expiry reminders together."`
  - Joined confirmation subject: `'Welcome to ${params.householdName}\'s shared stash!'` (was `'shared pantry'`).
- **Environment & Configuration Templates (`api/.env.example`, `api/.env.test`)**:
  - Default SMTP sender: `SMTP_FROM="Stash <no-reply@stash.local>"`.
  - WebAuthn Relying Party Name: `WEBAUTHN_RP_NAME=Stash-Test`.
- **System Workers & Log Comments (`api/src/workers/notification-send.ts`)**:
  - Expiry notification channel comments updated to reference stash record expiry.

### Non-Functional Requirements
- Ensure HTML email templates remain inline-CSS compliant and responsive.
- Zero breaking changes to `nodemailer` transports or SMTP delivery configurations.

## Architecture

```
Household Invite Triggered
  │
  ├──> sendHouseholdInvitationEmail: "Shared Stash Invitation"
  │
  └──> sendHouseholdJoinedConfirmationEmail: "Welcome to {name}'s shared stash!"
```

## Related Code Files

### Modify
- `api/src/services/households/invitation-email.ts`
- `api/.env.example`
- `api/.env.test`
- `api/src/workers/notification-send.ts`

## Implementation Steps

1. Edit `api/src/services/households/invitation-email.ts`:
   - Replace `'Shared Pantry Invitation'` with `'Shared Stash Invitation'`.
   - Update body text from `'collaborate on pantries'` to `'collaborate on stashes'`.
   - Replace `'shared pantry'` in joined confirmation subject with `'shared stash'`.
2. Edit `api/.env.example` and `api/.env.test`:
   - Update default sender string and WebAuthn test RP name to reference Stash.
3. Edit `api/src/workers/notification-send.ts`:
   - Update comment blocks to reference stash expiry notifications.
4. Run tests:
   - Run `pnpm --filter api test`.

## Success Criteria

- [ ] Household invitation email displays "Shared Stash Invitation".
- [ ] Household confirmation email subject is "Welcome to {householdName}'s shared stash!".
- [ ] API unit tests pass with 100% success.

## Risk Assessment

- **Risk**: Modifying email templates might cause rendering discrepancies on older mail clients.
- **Mitigation**: Only textual phrases inside `<h1/>`, `<p/>`, and subjects are updated; all table geometry, inline styles, and button links remain untouched.
