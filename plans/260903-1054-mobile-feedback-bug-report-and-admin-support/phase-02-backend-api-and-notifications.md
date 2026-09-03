---
phase: 2
title: "Backend API Services, Endpoints, and Notification Infrastructure"
status: completed
priority: P1
effort: "6-8h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Backend API Services, Endpoints, and Notification Infrastructure

## Overview
Implement Fastify routes, repositories, and notification triggers for user ticket submission, attachment handling, admin case management, two-way messaging, and push notifications.

## Requirements
- Functional:
  - User API routes under `/feedback`:
    - `POST /feedback/attachments`: Upload attachment files (multipart/form-data, max 10MB) returning attachment ID and preview metadata.
    - `GET /feedback/attachments/:id`: Stream attachment content with strict access control (ticket owner, uploader, or admin).
    - `POST /feedback`: Create a new ticket (validating type, title, description, up to 5 attachment IDs, device diagnostics).
    - `GET /feedback`: List authenticated user's tickets with cursor pagination and status filtering.
    - `GET /feedback/:id`: Fetch ticket details, attachments, and complete message thread.
    - `POST /feedback/:id/messages`: Allow user to reply to an ongoing ticket.
  - Admin API routes under `/admin/feedback`:
    - `GET /admin/feedback`: List tickets with multi-field search, status filter (`open`, `in_progress`, `replied`, `resolved`, `closed`), type filter (`bug`, `suggestion`, `feedback`), and cursor pagination.
    - `GET /admin/feedback/counts`: Return open and pending ticket counts for admin sidebar notification badge.
    - `GET /admin/feedback/:id`: Retrieve comprehensive ticket record including reporter details, device diagnostics, attachments, and message thread.
    - `POST /admin/feedback/:id/reply`: Admin sends a reply message, automatically setting status to `replied` and triggering user push notification.
    - `PATCH /admin/feedback/:id/status`: Admin updates ticket status (e.g. `in_progress`, `resolved`, `closed`) with optional resolution notes.
  - Notification Triggers:
    - New submission alerts administrators via internal event/outbox for real-time badge updates and admin moderation email digest.
    - Admin replies or resolutions enqueue push notifications to the reporter via `NotificationOutbox` using templates `feedback_reply` and `feedback_case_resolved`.
- Non-functional:
  - Rate limiting on creation endpoints (e.g. 5 tickets/hour, 20 messages/hour, 10 uploads/hour per user).
  - Strict data isolation: a non-admin user can never view, stream, or reply to another user's feedback ticket.
  - Full transactional integrity: ticket creation and attachment association execute inside a single Prisma `$transaction`.

## Architecture

### 1. Fastify User Routes (`api/src/routes/feedback/`)
- `index.ts`: Registers all feedback endpoints.
- `create.ts`: `POST /feedback`
  - Validates payload with `createFeedbackTicketSchema`.
  - Verifies all supplied `attachmentIds` belong to `req.user.id` and are unattached.
  - In a Prisma transaction:
    - Creates `FeedbackTicket`.
    - Binds `FeedbackAttachment` rows to the new `ticketId`.
    - Creates the initial `FeedbackMessage` (or links the description).
    - Dispatches an admin notification event.
- `list.ts`: `GET /feedback` (returns paginated user tickets).
- `get.ts`: `GET /feedback/:id` (validates `userId === req.user.id`).
- `messages.ts`: `POST /feedback/:id/messages` (appends message, resets status from `replied` to `in_progress`).
- `attachments.ts`:
  - `POST /feedback/attachments`: Handles multipart streaming upload via busboy/sharp.
  - `GET /feedback/attachments/:id`: Access control gate (`req.user.role === 'admin' || attachment.uploaderId === req.user.id`), streams file with safe headers.

### 2. Fastify Admin Routes (`api/src/routes/admin/feedback/`)
- `list.ts`: `GET /admin/feedback`
  - Supports query filters: `status`, `type`, `search` (matches title, description, or reporter email/name).
- `get.ts`: `GET /admin/feedback/:id`
  - Loads ticket, full user profile, full attachment records, and all messages.
- `reply.ts`: `POST /admin/feedback/:id/reply`
  - Validates `feedbackReplySchema`.
  - Creates `FeedbackMessage` with `senderType: 'admin'`, `senderUserId: req.user.id`.
  - Updates `FeedbackTicket.status` to `replied`.
  - Calls `enqueueOutbox` with `templateKey: 'feedback_reply'`.
- `status.ts`: `PATCH /admin/feedback/:id/status`
  - Validates `updateFeedbackStatusSchema`.
  - If status transitions to `resolved` or `closed`: sets `resolvedAt: new Date()`, `resolvedBy: req.user.id`, `resolutionNotes`.
  - Calls `enqueueOutbox` with `templateKey: 'feedback_case_resolved'`.

### 3. Notification Templates & Push Worker Integration
- Seed notification templates in `NotificationTemplate` table:
  - `feedback_reply`: Title "Support replied to your ticket", Body "Our support team has sent a message regarding: {title}".
  - `feedback_case_resolved`: Title "Support ticket resolved", Body "Your report '{title}' has been marked as resolved.".
- Update `api/src/workers/notification-send.ts`:
  - Handle `templateKey.startsWith('feedback_')`:
    - Resolves `ticketId` from job payload.
    - Loads `FeedbackTicket` to populate `{title}` placeholder.
    - Sends FCM push notification with payload `{ type: 'feedback_reply', ticketId: ticket.id }`.

## Related Code Files
- Create:
  - `api/src/routes/feedback/index.ts`
  - `api/src/routes/feedback/create.ts`
  - `api/src/routes/feedback/list.ts`
  - `api/src/routes/feedback/get.ts`
  - `api/src/routes/feedback/messages.ts`
  - `api/src/routes/feedback/attachments.ts`
  - `api/src/routes/admin/feedback/index.ts`
  - `api/src/routes/admin/feedback/list.ts`
  - `api/src/routes/admin/feedback/get.ts`
  - `api/src/routes/admin/feedback/reply.ts`
  - `api/src/routes/admin/feedback/status.ts`
  - `api/src/services/feedback/repository.ts`
  - `api/src/routes/feedback/feedback.test.ts`
  - `api/src/routes/admin/feedback/admin-feedback.test.ts`
- Modify:
  - `api/src/server.ts` (register `/feedback` and `/admin/feedback` routes)
  - `api/src/workers/notification-send.ts` (handle `feedback_*` push notification formatting)
  - `api/prisma/seed.ts` (add `feedback_reply` and `feedback_case_resolved` notification templates)

## Implementation Steps
1. Implement `api/src/services/feedback/repository.ts` for database CRUD, transactions, and notification dispatching.
2. Implement user Fastify routes in `api/src/routes/feedback/` with rate limits and authentication guards.
3. Implement admin Fastify routes in `api/src/routes/admin/feedback/` with admin-role guards.
4. Update `api/src/workers/notification-send.ts` to format push notifications for feedback events.
5. Register route plugins in `api/src/server.ts`.
6. Write integration tests verifying:
   - User ticket creation with multiple attachments.
   - Unauthorized user access prevention (403/404).
   - Admin listing, filtering, replying, and status closing.
   - Outbox notification entry generation.

## Success Criteria
- [x] Users can upload attachments up to 10 MB and receive secure attachment identifiers.
- [x] Users can create tickets with title, description, attachments, and device metadata.
- [x] Non-admin users cannot access tickets or attachments created by other users.
- [x] Admins can fetch all tickets, filter by status/type, reply, and resolve cases.
- [x] Replying or resolving creates outbox notification records destined for FCM push delivery.
- [x] Integration test suite passes with 100% assertions green.

## Risk Assessment
- **Risk**: Flood of automated or spam feedback submissions exhausts storage and spam admin queue.
- **Mitigation**: Apply Fastify IP/User rate limits (5 tickets/hour, 10 uploads/hour) and validate minimum input lengths (title >= 3 chars, description >= 10 chars).
- **Observable Signal**: Rate limit headers return 429 Too Many Requests.
- **Pre-decided Response**: Maintain strict rate limits and return standard RFC 7807 problem details.
