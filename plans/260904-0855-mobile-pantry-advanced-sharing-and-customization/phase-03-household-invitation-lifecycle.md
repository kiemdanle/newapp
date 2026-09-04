---
phase: 3
title: "Household Invitation Lifecycle with Multi-Channel Notifications and Confirmation"
status: done
priority: P1
effort: "5-6h"
dependencies: [2]
---

# Phase 3: Household Invitation Lifecycle with Multi-Channel Notifications and Confirmation

## Overview
Establish a robust, consent-driven household invitation lifecycle. Instead of instant forced membership, inviting a user generates a `HouseholdInvitation` record and dispatches notifications across three synchronized channels (in-app toast if currently active, high-priority push notification with deep link, and branded email with one-tap accept link). Invitee must review and accept the invite before membership is activated, followed by an immediate confirmation email upon joining.

## Requirements

### Functional
- **Data Model (`HouseholdInvitation`)**:
  - Prisma model:
    - `id`: UUID primary key.
    - `householdId`: UUID foreign key to `Household`.
    - `inviterUserId`: UUID foreign key to `User`.
    - `invitedEmail`: string (trimmed, lowercased).
    - `invitedUserId`: optional UUID foreign key to `User` (if account already exists).
    - `token`: cryptographically random alphanumeric string (32 chars) for web/app verification.
    - `status`: enum `pending` | `accepted` | `declined` | `expired` | `revoked`.
    - `expiresAt`: DateTime (defaults to 7 days from creation).
    - `createdAt`, `updatedAt`: timestamps.
- **Invitation Creation & Multi-Channel Dispatch**:
  - Owner creates invitation via `POST /v1/households/:id/invitations` with `{ email: string }`.
  - Backend verifies caller is household owner.
  - Checks if an active invite already exists for this email in this household (prevents duplicates).
  - Creates `HouseholdInvitation` record.
  - **Channel 1 — In-App Toast** (if user is currently active in the app):
    - Real-time in-app notification delivered through `inAppNotificationStore`:
      - Title: `"Household Invitation"`
      - Message: `"{InviterName} invited you to join '{HouseholdName}'"`
      - Action: `"Review"` opening the `HouseholdInvitationModal`.
  - **Channel 2 — Push Notification with Deep Link**:
    - If user has active FCM push tokens, dispatch push notification via BullMQ `notificationSendQueue`:
      - Title: `"Household Invitation"`
      - Body: `"{InviterName} invited you to join '{HouseholdName}'"`
      - Payload data: `{ type: 'household_invitation', token: invitation.token, householdId }`
      - Deep link: `expyrico://household/invitation?token={token}`
  - **Channel 3 — Branded Email with Accept Link**:
    <!-- Updated: Validation Session 1 - Unregistered Invitee One-Tap Flow -->
    - Professional responsive HTML email sent via Nodemailer using Expyrico `PALETTE`:
      - Subject: `"{InviterName} invited you to join {HouseholdName} on Expyrico"`
      - Visual card with household name, inviter avatar/name, and explanation.
      - Prominent CTA button: `"Accept Invitation"` linking to `https://expyrico.com/household/invite?token={token}`.
      - **Unregistered Invitee Handling**: If the recipient does not yet have an Expyrico account, the link opens a registration screen with the invite token pre-populated (`expyrico://auth/register?inviteToken={token}`). Upon completing registration and email verification, the user is presented directly with the `HouseholdInvitationModal` displaying the household and inviter details to explicitly tap `"Accept & Join"` or `"Decline"`. Membership is activated only upon explicit user confirmation, followed by the confirmation email.
  - When user opens the invite (via toast, push tap, email link, or in-app pending invites list):
    - Displays `HouseholdInvitationModal`:
      - Shows inviter name, household name, current member count, and explanation ("You will be able to view, add, and track shared groceries together").
      - Buttons: `"Accept & Join"` (Primary Fresh Sage) and `"Decline"` (Ghost).
  - Endpoint `POST /v1/households/invitations/:token/accept`:
    - Validates token exists, status is `pending`, and `expiresAt > now()`.
    - Locks household row via `lockHouseholdRow`.
    - Creates `HouseholdMember` record (`role: 'member'`).
    - Updates invitation `status = 'accepted'`.
    - Fans out shared records' expiry reminders to new member via `scheduleNewMemberReminders`.
    - Triggers local WatermelonDB sync.
  - Endpoint `POST /v1/households/invitations/:token/decline`:
    - Updates invitation `status = 'declined'`.
- **Post-Join Confirmation Email**:
  - Immediately after accepting, backend automatically dispatches a confirmation email:
    - Subject: `"Welcome to {HouseholdName}'s shared pantry!"`
    - Body: Welcomes user, outlines household members, and explains how to scan items directly into the shared pantry.
- **Pending Invites List**:
  - In `HouseholdSettings.tsx`, users can see `"Pending Invitations"` sent to others, with a `"Revoke"` button for owners.

### Non-Functional
- **Consent Security**: Users are never added to a household without explicitly pressing "Accept".
- **Token Cryptography**:
  <!-- Updated: Red Team Review - 256-bit entropy and constant-time comparison -->
  - Token is generated with `crypto.randomBytes(32).toString('base64url')` (256-bit cryptographic entropy).
  - Token verification in `accept` and `decline` endpoints uses `crypto.timingSafeEqual` to defeat timing attacks.
- **Anti-Spam Rate-Limiting**:
  <!-- Updated: Red Team Review - Multi-layer rate limiting against email bombing -->
  - Household limit: Max 5 invitations per household per hour, max 10 active pending invitations.
  - Global recipient limit: Max 3 invitations per recipient email address per 24 hours platform-wide.
  - User limit: Max 15 invitations per user per day across all owned households.
- **Safe Fallback**: 6-character code auto-join continues to function alongside email invitations.
## Architecture & Data Flow

```
[Owner enters partner@example.com in AddMemberForm]
       │
       ▼
POST /v1/households/:id/invitations { email: "partner@example.com" }
       │
       ├── 1. Generate HouseholdInvitation (status: pending, token: cryptoToken, expires in 7d)
       ├── 2. Channel 1: If user in-app ──► InAppNotificationBanner ("Review Invite")
       ├── 3. Channel 2: If push tokens exist ──► Send FCM Push (expyrico://household/invitation?token=...)
       └── 4. Channel 3: Send Branded Email via Nodemailer with "Accept Invitation" CTA button
       │
       ▼
[Invitee taps Toast / Push / Email CTA]
       │
       ▼
[Mobile App Opens HouseholdInvitationModal]
       │
       ├── Displays Household details & Inviter info
       │
       ├──► [Tap "Decline"] ──► POST /households/invitations/:token/decline ──► Status: declined
       │
       └──► [Tap "Accept"] ──► POST /households/invitations/:token/accept
                   │
                   ├── Validate token & lock household row
                   ├── Create HouseholdMember (role: member)
                   ├── Update invitation status: accepted
                   ├── Fan out shared record reminders to invitee
                   ├── Trigger WatermelonDB sync on client
                   └── Send Confirmation Email via Nodemailer: "Welcome to {HouseholdName}!"
```

## Related Code Files

### Create
- `api/prisma/migrations/20260904100000_household_invitations/migration.sql` — Migration for `household_invitations` table.
- `api/src/routes/households/invitations.ts` — Invitation endpoints (create, pending list, token preview, accept, decline, revoke).
- `api/src/services/households/invitation-email.ts` — Nodemailer templates for invite and post-join confirmation emails.
- `api/tests/integration/household-invitations.test.ts` — End-to-end integration tests for invite creation, email, push, accept, decline, and expiration.
- `apps/mobile/src/features/households/HouseholdInvitationModal.tsx` — Review sheet with Accept & Decline buttons.
- `apps/mobile/tests/unit/household-invitation-modal.test.tsx` — Unit tests for invitation modal presentation and actions.

### Modify
- `api/prisma/schema.prisma` — Add `HouseholdInvitation` model and relations.
- `packages/shared/src/schemas/household.ts` — Add schemas for invitation request/responses.
- `api/src/routes/households/index.ts` — Register invitation routes.
- `apps/mobile/src/navigation/RootNavigator.tsx` — Handle `expyrico://household/invitation` deep link.
- `apps/mobile/src/features/households/HouseholdSettings.tsx` — Display pending invitations with revoke action.
- `apps/mobile/src/api/households.ts` — Add React Query hooks for invitations.

## Implementation Steps

1. **Database Migration (`schema.prisma` & SQL)**:
   - Define `HouseholdInvitationStatus` enum and `HouseholdInvitation` model.
   - Run local migration and verify indexes on `[invitedEmail, status]` and `[invitedUserId, status]`.

2. **Email Templates (`invitation-email.ts`)**:
   - Implement `sendHouseholdInviteEmail({ to, inviterName, householdName, token })`:
     - Clean responsive table layout with Expyrico `PALETTE`.
     - Direct CTA linking to web landing page / app deep link.
   - Implement `sendHouseholdJoinedConfirmationEmail({ to, userName, householdName })`.

3. **Backend Routes (`routes/households/invitations.ts`)**:
   - `POST /households/:id/invitations`: Owner creates invitation; triggers push, email, and in-app channels.
   - `GET /households/invitations/mine`: Returns pending invitations for the authenticated user.
   - `GET /households/invitations/:token`: Public preview of household info without accepting.
   - `POST /households/invitations/:token/accept`: Accepts invitation, creates member, schedules reminders, sends confirmation email.
   - `POST /households/invitations/:token/decline`: Declines invitation.
   - `DELETE /households/:id/invitations/:invitationId`: Owner revokes pending invitation.

4. **Push & In-App Notification Hookup (`notification-send.ts`)**:
   <!-- Updated: Red Team Review - Explicit worker branch and BullMQ retry -->
   - In `api/src/workers/notification-send.ts`, add explicit branch:
     ```typescript
     else if (data.templateKey === 'household_invitation') {
       title = 'Household Invitation';
       body = `${data.payload?.inviterName ?? 'Someone'} invited you to join '${data.payload?.householdName}'`;
       payloadData = { type: 'household_invitation', token: data.payload?.token as string, householdId: data.recordId };
     }
     ```
   - Enqueue email and push deliveries with BullMQ `attempts: 5` and exponential backoff so transient SMTP/network errors are automatically retried.
   - When user opens app, check `useMyPendingInvitations()` and show banner toast if any invite is pending.

5. **Mobile Modal & Deep Link (`HouseholdInvitationModal.tsx`, `RootNavigator.tsx`)**:
   - Register deep link parser for `household/invitation`.
   - Build `HouseholdInvitationModal` with accept/decline mutations and tangible feedback.

## Success Criteria

- [x] Inviting a user by email creates a `pending` `HouseholdInvitation` record.
- [x] Active in-app users receive an immediate banner toast with "Review" CTA.
- [x] Push notification is dispatched to registered FCM tokens with deep link.
- [x] Branded invitation email is delivered with one-tap accept CTA button.
- [x] Invitee must explicitly accept the invitation before membership is granted.
- [x] Accepting promotes user to member, fans out reminders, and triggers sync.
- [x] Invitee immediately receives a branded confirmation email upon successful join.
- [x] 100% automated test coverage for entire lifecycle.

## Risk Assessment

- **Risk**: Invitee email does not match an existing Expyrico user at invite time.
  - **Observable Signal**: User signs up with that email days later.
  - **Mitigation**: When user registers and verifies their email, the auth flow queries pending `HouseholdInvitation` records matching their email, links `invitedUserId`, and immediately displays the `HouseholdInvitationModal` so the user can explicitly review and accept before joining.
- **Risk**: Inviter spamming invitations to arbitrary email addresses.
  - **Observable Signal**: Rapid invite requests in logs.
  - **Mitigation**: Strict rate limit of 5 invites per household per hour, plus max 10 active pending invites per household.
