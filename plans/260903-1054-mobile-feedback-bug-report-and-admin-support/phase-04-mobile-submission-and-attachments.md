---
phase: 4
title: "Mobile User Profile Touchpoint, Ticket Submission, and Attachment Handling"
status: completed
priority: P1
effort: "6-8h"
dependencies: ["phase-03-admin-console-management-and-replies.md"]
---

# Phase 4: Mobile User Profile Touchpoint, Ticket Submission, and Attachment Handling

## Overview
Implement the mobile entry point in the User tab (`ProfileScreen`), ticket creation workflow with type selection, title/description inputs, device diagnostics collection, attachment picking, and ticket history listing.

## Requirements
- Functional:
  - Add `SUPPORT & FEEDBACK` section to `apps/mobile/app/(app)/(tabs)/profile.tsx` with an `ActionRow` navigating to `FeedbackHub`.
  - Register `FeedbackHub` and `FeedbackDetail` in `apps/mobile/src/navigation/AppNavigator.tsx`.
  - Provide a dual-mode `FeedbackHubScreen`:
    - **Submit New**:
      - Type picker chips: 🐞 `Bug Report`, 💡 `Suggestion`, 💬 `General Feedback`.
      - Text inputs for Title (min 3 chars, max 120 chars) and Description (min 10 chars, max 3000 chars) with live counter indicators.
      - Attachment selector supporting camera capture and gallery selection via `photo-picker-adapter.ts`.
      - Attachment previews (thumbnails, remove badge, file size check < 10MB, max 5 files).
      - Automatic device diagnostic collection (Platform, OS version, App version).
      - Form submission with XHR multipart upload and progress indicator.
    - **My Tickets**:
      - Paginated list of user's past tickets with pull-to-refresh.
      - Status pills matching Expyrico palette (`Open`, `In Progress`, `Replied`, `Resolved`, `Closed`).
      - Type tags and new-reply indicators.
      - Tap-through navigation to ticket detail conversation.
- Non-functional & UI/UX:
  - Comply with Expyrico Colour Palette:
    - Primary CTA: Fresh Sage (`#4BAE8A`) or Honey (`#F5A623`).
    - Backgrounds: Warm White (`#FAFAF8`), Elevated Cards (`bgElevated`).
    - Dividers & Inactive Chips: Stone (`#F0F0ED`).
    - Active Type Chips: Mint Mist (`#D6F0E6`) background with Deep Sage (`#3A8F6F`) border and text.
    - Text: Almost Black (`#2C2C28`) primary, Pebble (`#8C8C85`) secondary.
  - Full keyboard avoidance (`KeyboardAvoidingView`), accessible touch targets (min 44x44 dp), and assistive technology labels (`accessibilityLabel`, `accessibilityRole`).

## Architecture

### 1. Profile Touchpoint (`apps/mobile/app/(app)/(tabs)/profile.tsx`)
```tsx
{/* Section: Support & Feedback */}
<View style={styles.section}>
  <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
    SUPPORT & FEEDBACK
  </Text>
  <View style={[styles.groupedCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
    <ActionRow
      testID="profile-feedback-row"
      accessibilityLabel="Open help and feedback"
      icon="chatbubble-ellipses-outline"
      label="Help & feedback"
      subtitle="Report bugs, send feedback, or submit suggestions"
      onPress={() => navigation.push('FeedbackHub')}
    />
  </View>
</View>
```

### 2. Navigation Contract (`apps/mobile/src/navigation/AppNavigator.tsx`)
```typescript
export type AppStackParamList = {
  // ...
  FeedbackHub: { initialTab?: 'submit' | 'tickets' } | undefined;
  FeedbackDetail: { id: string };
};
```

### 3. Mobile API Client (`apps/mobile/src/api/feedback.ts`)
- `uploadFeedbackAttachment(file: { path: string; mime: string }): Promise<FeedbackAttachment>`
  - Uses XHR upload to `/feedback/attachments` with progress tracking.
- `createFeedbackTicket(payload: CreateFeedbackTicketInput): Promise<FeedbackTicket>`
  - Calls `POST /feedback`.
- `fetchMyFeedbackTickets(cursor?: string): Promise<FeedbackTicketPage>`
  - Calls `GET /feedback`.
- `fetchFeedbackTicketDetail(id: string): Promise<FeedbackTicketDetail>`
  - Calls `GET /feedback/:id`.

### 4. Component Structure (`apps/mobile/app/(app)/feedback/`)
- `index.tsx` (`FeedbackHubScreen`):
  - Top tab switcher / segmented control: `[ Submit New ]` | `[ My Tickets (N) ]`.
  - **Submit Subview**:
    - `FeedbackTypeSelector`: 3 selectable chips with icons and Expyrico theme colors.
    - `FeedbackInputs`: Title and Description inputs with validation states and character counts.
    - `FeedbackAttachmentList`: Horizontal scroll list of picked photos/files + Add Button triggering camera or gallery alert.
    - `FeedbackDeviceCard`: Compact info box displaying device OS and app version.
    - `SubmitButton`: Full-width CTA with loading spinner.
  - **My Tickets Subview**:
    - `FlatList` of `FeedbackTicketCard` items.
    - Status pills (`Open` in Fresh Sage, `Replied` in Mint Mist with dot badge, `Resolved` in Soft Butter, `Closed` in Stone).
    - Friendly Empty State when list has zero items.

## Related Code Files
- Create:
  - `apps/mobile/app/(app)/feedback/index.tsx`
  - `apps/mobile/app/(app)/feedback/components/FeedbackTypeSelector.tsx`
  - `apps/mobile/app/(app)/feedback/components/FeedbackAttachmentPicker.tsx`
  - `apps/mobile/app/(app)/feedback/components/FeedbackTicketCard.tsx`
  - `apps/mobile/src/api/feedback.ts`
  - `apps/mobile/tests/feedback/FeedbackHub.test.tsx`
- Modify:
  - `apps/mobile/app/(app)/(tabs)/profile.tsx`
  - `apps/mobile/src/navigation/AppNavigator.tsx`

## Implementation Steps
1. Add `FeedbackHub` route to `AppStackParamList` and `AppNavigator.tsx`.
2. Add `SUPPORT & FEEDBACK` section and `ActionRow` in `profile.tsx`.
3. Implement `apps/mobile/src/api/feedback.ts` integrating with existing `apiClient` and XHR upload helper.
4. Build `FeedbackTypeSelector` and `FeedbackAttachmentPicker` using `photo-picker-adapter.ts`.
5. Implement `FeedbackHubScreen` with segmented control, form validation, error banners, and success navigation.
6. Implement `FeedbackTicketCard` list view with pull-to-refresh and empty state.
7. Write unit and snapshot tests with `@testing-library/react-native`.

## Success Criteria
- [x] User tab displays "Help & feedback" action row leading to `FeedbackHub`.
- [x] Users can toggle between Bug Report, Suggestion, and Feedback types.
- [x] Form validates title (>=3 chars) and description (>=10 chars) before enabling submission.
- [x] Attachments can be added via camera or gallery; thumbnails render with removal option.
- [x] Submissions successfully upload attachments, create tickets, and show immediate confirmation.
- [x] "My Tickets" renders all user tickets with proper status badges and dates.

## Risk Assessment
- **Risk**: Device photo picking crashes if permissions are denied or library fails on newer Android versions.
- **Mitigation**: Reuse established `photo-picker-adapter.ts` which safely catches cancellations, requests runtime permissions, and presents user-friendly alert dialogs.
- **Observable Signal**: Permission denial alerts show gracefully without app crashing.
- **Pre-decided Response**: Allow submitting tickets without attachments if user declines camera/photo permissions.
