# Batched Admin Moderation Notification Plan

**Date:** 2026-08-14
**Status:** Planned; implementation not started
**Plan:** `plans/260814-0412-batched-admin-moderation-notifications/plan.md`

## Decision

Plan a durable server-side moderation notification pipeline:

- Every 15 minutes, aggregate only fresh `pending` product submissions and pending product revisions.
- Target active admins only.
- Deliver a count-only summary through FCM push and SMTP email.
- Route both channels to the existing `/products/pending` queue.
- Persist events, batches, and separate recipient/channel delivery outcomes in PostgreSQL.
- Treat external delivery as at-least-once; use bounded retries and recovery rather than claiming exactly-once semantics.
- Retain terminal delivery history for 90 days; never clean unbatched or retryable work.
- Treat every `pending` transition occurrence—including stale-revision rebase—as distinct by post-transition version.
- Require current database admin role, canonical server/mobile admin URL config, delivery claim fencing, provider deadlines, per-token FCM outcomes, a scheduler-independent watchdog, and staging migration proof before rollout.

## Why

The current notification-send worker is record-specific and the existing notification outbox is giveaway-shaped. Reusing either for moderation would overload incompatible contracts and risk dropped sends or notification floods. The plan therefore isolates moderation batching while leaving expiry and giveaway notification paths unchanged.

## Scope

Included: transactional event capture, BullMQ scheduling/recovery, push/email delivery, editable count templates, admin backlog badge/history, safe mobile push-open behavior, automated verification, and operational docs.

Excluded: product/creator details in notifications, repeated reminders for unchanged backlog, email/push changes for expiry or giveaway notifications, and refactoring legacy notification infrastructure.

## Next

Run plan validation after red-team findings are reconciled, then execute with `/ck:cook /opt/newapp/plans/260814-0412-batched-admin-moderation-notifications/plan.md` when approved.

## Unresolved Questions

None.
