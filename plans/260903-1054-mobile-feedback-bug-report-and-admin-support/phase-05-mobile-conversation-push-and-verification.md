---
phase: 5
title: "Mobile Conversation Thread, Push Notification Deep-Linking, and End-to-End Verification"
status: completed
priority: P1
effort: "6-8h"
dependencies: ["phase-04-mobile-submission-and-attachments.md"]
---

# Phase 5: Mobile Conversation Thread, Push Notification Deep-Linking, and End-to-End Verification

## Overview
Complete the mobile ticket conversation loop with real-time push notification deep-linking, full attachment viewing, user follow-up replies, case closure notices, and comprehensive multi-tier test verification.

## Requirements
- Functional:
  - Mobile Ticket Detail Screen (`apps/mobile/app/(app)/feedback/[id].tsx`):
    - Full ticket header with status pill, category badge, and creation timestamp.
    - Initial description card and attachment preview gallery with tap-to-expand image modal.
    - Chronological message conversation thread with distinct styling for Support/Admin vs User.
    - User reply composer allowing follow-up messages while the case remains active.
    - Resolved/Closed banner preventing redundant replies once a case is completed.
  - Push Notification Deep-Linking:
    - Update `apps/mobile/src/features/push/handle-notification-open.ts` to recognize `feedback_reply` and `feedback_case_resolved`.
    - Automatically navigate to `FeedbackDetail` with `id: data.ticketId` when notification is tapped.
  - End-to-End Verification:
    - Verify complete flow from mobile submission -> admin dashboard -> admin reply -> user push notification -> case resolution.
- Non-functional:
  - Adhere to Expyrico visual design standards:
    - Admin message bubbles in Mint Mist (`#D6F0E6`) with Fresh Sage (`#4BAE8A`) left rule and shield icon.
    - User message bubbles in Soft Butter (`#FEEFC3`) or Warm White card with neutral borders.
    - Resolved banner in Soft Butter with Honey accent icon.
  - Maintain offline resilience and error handling for failed message sends.

## Architecture

### 1. Mobile Ticket Detail Screen (`apps/mobile/app/(app)/feedback/[id].tsx`)
```tsx
export default function FeedbackDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'FeedbackDetail'>>();
  const { id } = route.params;
  const theme = useTheme();
  const query = useQuery({ queryKey: ['feedback', id], queryFn: () => fetchFeedbackTicketDetail(id) });
  const replyMutation = useMutation({
    mutationFn: (message: string) => sendFeedbackReply(id, message),
    onSuccess: () => query.refetch(),
  });

  // Render Header, Attachments, Messages FlatList, and ReplyBar
}
```

### 2. Push Notification Handler Integration (`apps/mobile/src/features/push/handle-notification-open.ts`)
```typescript
if (
  (data.type === 'feedback_reply' || data.type === 'feedback_case_resolved') &&
  typeof data.ticketId === 'string' &&
  data.ticketId.length > 0
) {
  navigate('FeedbackDetail', { id: data.ticketId });
  return true;
}
```

### 3. Verification Test Matrix

| Layer | Target | Test File | Key Assertions |
|-------|--------|-----------|----------------|
| **Shared** | Schemas & Types | `packages/shared/src/schemas/feedback.test.ts` | Validates type enums, title/desc lengths, attachment limits, reject invalid payloads |
| **Backend** | Fastify User Routes | `api/src/routes/feedback/feedback.test.ts` | Multipart upload size limits, ticket creation, user isolation (403 on cross-user reads), message replies |
| **Backend** | Fastify Admin Routes | `api/src/routes/admin/feedback/admin-feedback.test.ts` | Admin list filters, admin replies, status transitions, outbox entry generation |
| **Admin** | Server Actions | `apps/admin/tests/unit/feedback-actions.test.ts` | `replyFeedbackAction` and `updateFeedbackStatusAction` trigger API and revalidate paths |
| **Mobile** | UI Components | `apps/mobile/tests/feedback/FeedbackDetail.test.tsx` | Thread rendering, admin bubble styling, user reply submission, closed ticket banner |
| **Mobile** | Push Navigation | `apps/mobile/tests/push/handle-notification-open.test.ts` | `feedback_reply` type routes to `FeedbackDetail` with `ticketId` |

## Related Code Files
- Create:
  - `apps/mobile/app/(app)/feedback/[id].tsx`
  - `apps/mobile/app/(app)/feedback/components/FeedbackMessageBubble.tsx`
  - `apps/mobile/app/(app)/feedback/components/FeedbackImageViewerModal.tsx`
  - `apps/mobile/tests/feedback/FeedbackDetail.test.tsx`
- Modify:
  - `apps/mobile/src/features/push/handle-notification-open.ts`
  - `apps/mobile/tests/push/handle-notification-open.test.ts`

## Implementation Steps
1. Implement `FeedbackMessageBubble` and `FeedbackImageViewerModal` components.
2. Build `FeedbackDetailScreen` assembling header, attachment thumbnails, message thread, and reply composer.
3. Handle closed/resolved case states by disabling reply input and displaying resolution notes.
4. Update `handle-notification-open.ts` to route feedback push notifications to `FeedbackDetail`.
5. Execute full automated test suite across shared, api, admin, and mobile packages.
6. Perform manual smoke test verifying end-to-end flow.

## Success Criteria
- [x] Users can view their submitted tickets, descriptions, and full-resolution image attachments.
- [x] Conversation thread cleanly distinguishes Support replies from User follow-ups.
- [x] Users can reply to open tickets, and reply input disables cleanly when a ticket is marked resolved or closed.
- [x] Tapping a feedback push notification deep-links directly into the appropriate ticket detail screen.
- [x] All automated unit, integration, and snapshot tests pass with 100% success rate.

## Risk Assessment
- **Risk**: Push notifications arrive while app is in the background and user taps it before authentication state is hydrated.
- **Mitigation**: `navigationRef` in `handle-notification-open.ts` queues navigation until `navigationRef.isReady()` and authentication store is restored.
- **Observable Signal**: Notification tap opens app directly to the target ticket without dropping params.
- **Pre-decided Response**: Maintain safe navigation queue in `navigationRef.ts`.
