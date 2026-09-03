---
phase: 3
title: "Admin Console Management, Conversation Thread, and Case Resolution UI"
status: completed
priority: P1
effort: "6-8h"
dependencies: ["phase-02-backend-api-and-notifications.md"]
---

# Phase 3: Admin Console Management, Conversation Thread, and Case Resolution UI

## Overview
Equip platform operators with a complete admin management interface in `apps/admin` to filter feedback submissions, inspect device diagnostics and attachments, converse with users via threaded replies, and resolve/close cases.

## Requirements
- Functional:
  - Add "User Feedback" item to Admin navigation with open/pending badge counter.
  - Implement `/feedback` queue page with rich filtering:
    - Status: `All`, `Open`, `In Progress`, `Replied`, `Resolved`, `Closed`.
    - Type: `All`, `Bug`, `Suggestion`, `Feedback`.
    - Text Search: searches ticket title, description, and reporter name/email.
    - Cursor pagination using `LoadMore`.
  - Implement `/feedback/[id]` ticket detail view:
    - Header with type badge, title, status badge, creation date, reporter profile card (with direct link to `/users/[id]`).
    - Device Diagnostics & Environment card (Platform, OS version, App build, Device model).
    - Attachments Gallery with interactive modal preview for images and download triggers for files.
    - Chronological conversation timeline distinguishing user reports from administrator replies.
    - Reply composition form (`feedback-reply-box.tsx`) supporting canned response snippets and real-time transition updates.
    - Case lifecycle controls (`feedback-case-actions.tsx`) to change status, enter resolution notes, and close/reopen tickets.
- Non-functional & UI/UX:
  - Adhere strictly to Expyrico Colour Requirements:
    - Fresh Sage (`#4BAE8A`) for primary headers, open badges, and admin badges.
    - Mint Mist (`#D6F0E6`) for admin message bubble backgrounds and success highlights.
    - Honey (`#F5A623`) for In-Progress states and Bug highlights.
    - Stone (`#F0F0ED`) for neutral badges, closed states, and dividers.
    - Alert Red (`#E0442A`) used exclusively for destructive actions (e.g. deleting spam tickets).
  - Accessible, responsive layout with keyboard shortcuts and mobile-friendly drawer support.

## Architecture

### 1. Navigation & State Integration
- Update `apps/admin/src/lib/nav.ts`:
  ```typescript
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', href: '/reports', icon: 'Flag' },
      { label: 'User Feedback', href: '/feedback', icon: 'HelpCircle' },
      // ...
    ]
  }
  ```
- Update `apps/admin/src/components/sidebar.tsx`:
  - Import `HelpCircle` from `lucide-react` into `ICON_MAP`.
  - Display dynamic pending feedback badge on `/feedback` route.

### 2. Admin API Client & Server Actions
- Update `apps/admin/src/lib/admin-api.ts`:
  ```typescript
  export const serverAdminApi = {
    // ...
    feedback: {
      list: (query?: FeedbackListQuery) =>
        apiServerFetch('/admin/feedback', { query }),
      get: (id: string) =>
        apiServerFetch(`/admin/feedback/${id}`),
      reply: (id: string, body: FeedbackReplyInput) =>
        apiServerFetch(`/admin/feedback/${id}/reply`, { method: 'POST', body }),
      updateStatus: (id: string, body: UpdateFeedbackStatusInput) =>
        apiServerFetch(`/admin/feedback/${id}/status`, { method: 'PATCH', body }),
    }
  };
  ```
- Update `apps/admin/src/lib/actions.ts`:
  - `replyFeedbackAction(ticketId: string, message: string)`: Calls `serverAdminApi.feedback.reply`, revalidates `/feedback` and `/feedback/[id]`.
  - `updateFeedbackStatusAction(ticketId: string, status: string, notes?: string)`: Calls `serverAdminApi.feedback.updateStatus`, revalidates path.

### 3. Component Architecture (`apps/admin/src/app/(admin)/feedback/`)
- `page.tsx`: Server Component rendering the feedback table.
  - Loads data via `serverAdminApi.feedback.list(searchParams)`.
  - Columns:
    - **Type**: Styled pill with icon (`Bug`, `Suggestion`, `Feedback`).
    - **Title & Preview**: Primary bold link to detail page with 1-line description snippet.
    - **Submitted By**: User full name, email subtext, link to user admin profile.
    - **Device / OS**: Compact mono tag (e.g. `iOS 17.5 • iPhone 15`).
    - **Attachments**: Badge with paperclip icon and count (e.g. `2 files`).
    - **Status**: Visual `StatusBadge` matching Expyrico palette.
    - **Age**: Relative time formatted string.
- `[id]/page.tsx`: Detailed ticket workspace.
  - Composed of:
    - `FeedbackHeader`: Ticket metadata, user bio, creation timestamp.
    - `FeedbackDiagnostics`: Device metadata callout.
    - `FeedbackAttachments`: Responsive thumbnail grid with light-box preview.
    - `FeedbackThread`: Message cards ordered chronologically.
    - `FeedbackReplyBox`: Client component with optimistic state, canned quick-replies, and submit handling.
    - `FeedbackCaseActions`: Status management drawer/buttons ("Mark in Progress", "Resolve Case", "Close Case", "Reopen").

## Related Code Files
- Create:
  - `apps/admin/src/app/(admin)/feedback/page.tsx`
  - `apps/admin/src/app/(admin)/feedback/feedback-filters.tsx`
  - `apps/admin/src/app/(admin)/feedback/[id]/page.tsx`
  - `apps/admin/src/app/(admin)/feedback/[id]/feedback-reply-box.tsx`
  - `apps/admin/src/app/(admin)/feedback/[id]/feedback-case-actions.tsx`
  - `apps/admin/src/app/(admin)/feedback/[id]/feedback-attachments.tsx`
  - `apps/admin/src/app/(admin)/feedback/[id]/feedback-diagnostics.tsx`
  - `apps/admin/tests/unit/feedback-actions.test.ts`
- Modify:
  - `apps/admin/src/lib/nav.ts`
  - `apps/admin/src/components/sidebar.tsx`
  - `apps/admin/src/lib/admin-api.ts`
  - `apps/admin/src/lib/actions.ts`

## Implementation Steps
1. Add `HelpCircle` icon to `sidebar.tsx` and register `User Feedback` in `nav.ts`.
2. Add typed API wrappers in `admin-api.ts` and server actions in `actions.ts`.
3. Create `/feedback/page.tsx` and filter bar component using existing `FilterBar` and `SelectFilter`.
4. Create `/feedback/[id]/page.tsx` assembling ticket header, diagnostics, attachment gallery, and message thread.
5. Implement `feedback-reply-box.tsx` with textarea, canned snippets, and error handling.
6. Implement `feedback-case-actions.tsx` for status transitions (`in_progress`, `resolved`, `closed`).
7. Write unit tests for server actions and component state transitions.

## Success Criteria
- [x] Admin sidebar displays "User Feedback" with correct icon and active route highlight.
- [x] Admins can filter tickets by type, status, and text search across titles and users.
- [x] Detail view renders user details, device diagnostics, and image attachments with preview.
- [x] Sending a reply appends message to the thread, updates status to `replied`, and triggers revalidation.
- [x] Resolving/closing case updates status, stamps resolution timestamp, and records resolution notes.
- [x] Visual design adheres strictly to Expyrico brand colors and accessibility standards.

## Risk Assessment
- **Risk**: Stale data or concurrent operator updates when multiple admins view the same ticket.
- **Mitigation**: Use Next.js `revalidatePath` on mutation and include ticket `updatedAt` version concurrency checks in server actions.
- **Observable Signal**: Submitting an action on a ticket closed by another operator returns a 409 conflict message.
- **Pre-decided Response**: Catch 409 and refresh page with an informative toast: "This case was updated by another administrator."
