---
phase: 1
title: "Contracts, Data Models, and Attachment Storage Foundation"
status: completed
priority: P1
effort: "4-6h"
dependencies: []
---

# Phase 1: Contracts, Data Models, and Attachment Storage Foundation

## Overview
Establish the core data architecture, shared validation contracts, and secure storage foundations for user feedback, bug reports, suggestions, and administrator replies.

## Requirements
- Functional:
  - Define PostgreSQL/Prisma models: `FeedbackTicket`, `FeedbackAttachment`, `FeedbackMessage`.
  - Support ticket classification into `bug`, `suggestion`, or `feedback`.
  - Support ticket lifecycle status: `open`, `in_progress`, `replied`, `resolved`, `closed`.
  - Support message thread attribution: `user` or `admin`.
  - Shared validation contracts in `@expyrico/shared` for ticket creation, replies, status changes, and query filters.
- Non-functional & Security:
  - Private attachment file path containment preventing directory traversal (`assertUuidSegment`, safe storage roots).
  - Strict MIME validation allowlist (`image/jpeg`, `image/png`, `image/heic`, `image/webp`, `application/pdf`, `text/plain`).
  - Size limitation: 10 MB per file, max 5 attachments per ticket.
  - Full TypeScript type safety exported through `@expyrico/shared` and mirrored to mobile local packages.

## Architecture

### 1. Database Schema (`api/prisma/schema.prisma`)
```prisma
enum FeedbackType {
  bug
  suggestion
  feedback
}

enum FeedbackStatus {
  open
  in_progress
  replied
  resolved
  closed
}

enum FeedbackSenderType {
  user
  admin
}

model FeedbackTicket {
  id              String               @id @default(uuid()) @db.Uuid
  userId          String               @map("user_id") @db.Uuid
  type            FeedbackType
  title           String
  description     String
  status          FeedbackStatus       @default(open)
  deviceInfo      Json?                @map("device_info")
  resolvedAt      DateTime?            @map("resolved_at")
  resolvedBy      String?              @map("resolved_by") @db.Uuid
  resolutionNotes String?              @map("resolution_notes")
  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  user            User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  attachments     FeedbackAttachment[]
  messages        FeedbackMessage[]

  @@index([userId, createdAt])
  @@index([status, type, createdAt])
  @@map("feedback_tickets")
}

model FeedbackAttachment {
  id            String         @id @default(uuid()) @db.Uuid
  ticketId      String?        @map("ticket_id") @db.Uuid
  uploaderId    String         @map("uploader_id") @db.Uuid
  fileName      String         @map("file_name")
  mimeType      String         @map("mime_type")
  fileSizeBytes Int            @map("file_size_bytes")
  storageKey    String         @map("storage_key")
  createdAt     DateTime       @default(now()) @map("created_at")

  ticket        FeedbackTicket? @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  uploader      User           @relation(fields: [uploaderId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([uploaderId])
  @@map("feedback_attachments")
}

model FeedbackMessage {
  id            String             @id @default(uuid()) @db.Uuid
  ticketId      String             @map("ticket_id") @db.Uuid
  senderType    FeedbackSenderType @map("sender_type")
  senderUserId  String             @map("sender_user_id") @db.Uuid
  message       String
  createdAt     DateTime           @default(now()) @map("created_at")

  ticket        FeedbackTicket     @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  senderUser    User               @relation(fields: [senderUserId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@map("feedback_messages")
}
```

### 2. Shared Schemas (`packages/shared/src/schemas/feedback.ts`)
- `feedbackTypeSchema`: `z.enum(['bug', 'suggestion', 'feedback'])`
- `feedbackStatusSchema`: `z.enum(['open', 'in_progress', 'replied', 'resolved', 'closed'])`
- `feedbackDeviceInfoSchema`: `z.object({ platform: z.enum(['ios', 'android', 'web']), osVersion: z.string().max(50), appVersion: z.string().max(50), deviceModel: z.string().max(100).optional() })`
- `createFeedbackTicketSchema`:
  - `type`: `feedbackTypeSchema`
  - `title`: `z.string().trim().min(3).max(120)`
  - `description`: `z.string().trim().min(10).max(3000)`
  - `attachmentIds`: `z.array(z.string().uuid()).max(5).default([])`
  - `deviceInfo`: `feedbackDeviceInfoSchema.optional()`
- `feedbackReplySchema`:
  - `message`: `z.string().trim().min(1).max(3000)`
- `updateFeedbackStatusSchema`:
  - `status`: `feedbackStatusSchema`
  - `resolutionNotes`: `z.string().trim().max(1000).optional()`

### 3. Attachment Storage Service (`api/src/services/feedback/attachment-storage.ts`)
- Implements `resolveFeedbackAttachmentPath(root, uploaderId, attachmentId, variantOrFilename)`.
- Validates strict UUID for `uploaderId` and `attachmentId`.
- Strictly enforces containment within `config.media.root/private/feedback/`.
- Processes uploaded images via `sharp` (auto-orient, generate thumbnail and display webp variants, sanitize EXIF data).
- Saves non-image documents (PDF, TXT) safely as raw stream with byte counters and size verification.

## Related Code Files
- Create:
  - `packages/shared/src/schemas/feedback.ts`
  - `packages/shared/src/schemas/admin/feedback.ts`
  - `api/src/services/feedback/attachment-storage.ts`
  - `api/src/services/feedback/attachment-storage.test.ts`
  - `packages/shared/src/schemas/feedback.test.ts`
  - `api/prisma/migrations/20260903110000_feedback_tickets_and_replies/migration.sql`
- Modify:
  - `api/prisma/schema.prisma`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/error.ts` (add `FEEDBACK_*` error codes)

## Implementation Steps
1. Add `FeedbackTicket`, `FeedbackAttachment`, `FeedbackMessage` models and enums to `api/prisma/schema.prisma`.
2. Generate migration SQL `20260903110000_feedback_tickets_and_replies` with appropriate indexes and cascade deletes.
3. Author shared Zod contracts in `packages/shared/src/schemas/feedback.ts` and `admin/feedback.ts`.
4. Export schemas in `packages/shared/src/index.ts` and compile shared build (`pnpm --filter @expyrico/shared build`).
5. Implement `attachment-storage.ts` adhering to project containment checks (`resolveMediaPath`, `assertUuidSegment`).
6. Write unit tests for schema validation and attachment storage path isolation.

## Success Criteria
- [x] Database migration applies cleanly with foreign key relationships and index definitions.
- [x] Zod schemas properly accept valid inputs and reject malformed titles, overly long messages, or unsupported MIME types.
- [x] Attachment storage strictly prevents path traversal attempts (e.g. `../../etc/passwd` throws `MediaPathError`).
- [x] `packages/shared` builds cleanly and passes all unit tests.

## Risk Assessment
- **Risk**: Storing un-sanitized user file attachments might present malware or XSS risks if served with improper headers.
- **Mitigation**: Private attachments are never served statically with execute/inline permissions; images are processed/re-encoded through `sharp`, and raw files are streamed with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- **Observable Signal**: Serving an attachment triggers unexpected browser evaluation.
- **Pre-decided Response**: Enforce strict stream headers in `GET /feedback/attachments/:id` and strip executable content.
