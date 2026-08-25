---
phase: 2
title: Schedule and deliver notifications
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Schedule and Deliver Notifications

<!-- Updated: Validation Session 1 — fenced delivery ownership, watchdog recovery, per-token FCM outcomes, SMTP deadlines, zero-recipient policy, and terminal cleanup. -->

## Overview

Add an idempotent 15-minute BullMQ scheduler and durable channel dispatcher. Aggregate fresh moderation events once, snapshot active-admin recipients, then independently deliver push and email alerts with bounded retry, leases, structured logs, and recovery after queue/process failures.

## Requirements

- Functional:
  - Register a stable every-15-minute scheduler at worker startup without duplicating schedules across instances.
  - Create one batch only when at least one unbatched event exists; retain distinct new-product/revision counts.
  - Create two delivery rows (`push`, `email`) for each active admin present at batch creation.
  - Render count-only template content; push payload includes type `moderation_queue` and canonical `url`, email links to the same URL.
  - FCM delivery handles multiple tokens in deterministic provider-limit chunks, token-specific invalidation, durable per-token outcomes, and a no-active-token skipped outcome.
  - SMTP delivery uses explicit connection/greeting/socket deadlines shorter than a renewable delivery lease and records sanitized provider outcome without exposing recipient data in logs.
  - Recover pending/expired processing deliveries on subsequent ticks; retries use bounded exponential backoff and an explicit terminal state. A successful channel stays terminal when its sibling channel fails.
  - A zero-recipient batch is terminally handled and emits an operational-health signal rather than being replayed after a future admin invite.
- Non-functional:
  - Reuse BullMQ 5's current `upsertJobScheduler` API, not the legacy `repeat` API used by the media-cleanup job.
  - PostgreSQL is the system of record; BullMQ is a wake-up/worker transport only, with a scheduler-independent watchdog/recovery path.
  - Do not reuse record-only `NotificationSendJob` or giveaway-only `NotificationOutbox` until they are separately redesigned.

## Architecture

```text
scheduleModerationNotifications() at startWorkers()
  └─ Queue.upsertJobScheduler('moderation-notification-every-15-minutes', { every: 900_000 }, ...)
       └─ Worker processModerationNotificationTick()
            ├─ claim unbatched events (Postgres tx / SKIP LOCKED)
            ├─ create a batch + recipient x {push,email} deliveries
            └─ deliver/recover due rows
                 ├─ lease one row atomically
                 ├─ fetch recipient: active admin? otherwise skipped
                 ├─ push: active tokens -> sendFcmPush -> log per token/outcome
                 └─ email: sendModerationQueueEmail -> status/outcome
```

The batch tick uses a named Redis lock/lease only to avoid needless concurrent scans; PostgreSQL event/delivery claims remain the authority. Renew the tick lock while live and treat a failure to acquire as a normal no-op. A lifecycle-managed, unref'd watchdog also calls the database-authoritative tick/recovery primitive and periodically re-upserts the scheduler. It starts/stops with workers, so Redis scheduler loss does not strand events while processes remain alive.

Every delivery claim has an opaque random `leaseOwner` token. Claim atomically sets `status=processing`, `leaseOwner`, and expiry using database time. Lease renewal, success, skip, retry, terminal failure, and release updates must include `WHERE id = ? AND status = 'processing' AND leaseOwner = ?`; a zero-row result means ownership was lost and the stale worker cannot mutate outcome state. Provider I/O gets a bounded deadline shorter than the renewable lease.

Use the parsed canonical `cfg.frontend.adminUrl` to build the one trusted target: `new URL('/products/pending', cfg.frontend.adminUrl)`. Production config accepts only HTTPS origins with empty userinfo/fragment; development exception is explicit. Do not receive a redirect target from events, templates, or jobs. Push `data` contains just:

```ts
{ type: 'moderation_queue', url: 'https://admin.example/products/pending', batchId: '<uuid>' }
```

The `batchId` is diagnostic/correlation-only—not authorization. Never send product IDs, edit IDs, submitter IDs, product names, private-media URLs, email addresses, token values, or raw provider credentials in a payload or log.

## Related Code Files

- Create: `api/src/queues/jobs/moderation-notifications.ts` — queue, scheduler registration, worker, distributed lock, batch/event claim, recovery tick.
- Create: `api/src/services/notifications/moderation-queue.ts` — template parsing/rendering, recipient selection, delivery state transitions, safe URL creation.
- Create: `api/src/services/notifications/moderation-email.ts` — branded count-only email body using the existing nodemailer transport abstraction.
- Modify: `api/src/services/auth/email.ts` — extract a narrowly reusable private transport/send primitive, preserving verification/reset behavior and test-safe logging.
- Modify: `api/src/services/push/fcm-push.ts` — accept safe generic data, chunk FCM multicast sends, preserve token/result correlation, and retain invalid-token classification.
- Modify: `api/src/workers/runner.ts` — start moderation worker/watchdog and register scheduler with safe error logging.
- Modify: `api/src/queues/index.ts` — export/register moderation queue so admin Bull-board can discover it.
- Create/Modify: a moderation pipeline health repository/service owned by this phase; Phase 3 consumes its admin-safe projection. Do not overload record-oriented `push-logs`.
- Create: `api/tests/unit/moderation-notification-worker.test.ts` — scheduler, aggregation, lease/recovery, channels, retry tests.
- Create: `api/tests/integration/moderation-notification-delivery.test.ts` — real database claim/constraint/concurrency paths.
- Modify: `api/tests/unit/workers-notification-send.test.ts` only for shared FCM helper regression coverage; do not rewrite expiry tests.

## Implementation Steps

1. Confirm the installed BullMQ 5.77.x APIs and type signatures. Define the queue with `upsertJobScheduler('moderation-notification-every-15-minutes', { every: 15 * 60_000 }, { name: 'moderation-notification-tick', data: {}, opts: { attempts, backoff, removeOnComplete, removeOnFail } })`. A watchdog calls this reconciliation periodically as well as at boot.
2. Build `processModerationNotificationTick(now = new Date())` as a testable DB-authoritative pass. Acquire a token-guarded scan lock, claim a bounded ordered page of `batchId IS NULL` events in a transaction using `FOR UPDATE SKIP LOCKED`, create one batch, query database-current active admins, and create unique recipient-channel delivery rows. An empty claim creates no batch; a zero-recipient claim creates an auditable terminal batch and health signal.
3. Make event batching fair and bounded: order by `submittedAt,id`; carry excess forward; preserve one occurrence per `(kind, sourceId, submissionVersion)`.
4. Start an unref'd watchdog with workers. It executes/reconciles the durable tick, recovery, and scheduler upsert on an interval independent of BullMQ; stop it in `stopWorkers`. Test a Redis flush while worker processes remain live.
5. Recover due delivery rows via a conditional database claim (`pending` or expired `processing`, `availableAt <= now`) which writes a fresh random `leaseOwner`. Renew while provider I/O is live. Every finalizer is fenced by `(id, status=processing, leaseOwner)`; zero updates mean lost ownership. Recheck recipient DB role/status and mark ineligible users skipped.
6. Render moderation template plain text via the keyed Phase 1 helper. Substitute only server-derived integers, HTML-escape output, and construct the sole anchor from canonical URL. Disabled/invalid templates terminally skip only their current deliveries.
7. Push: resolve active tokens; if none mark skipped. Chunk at the FCM multicast maximum, preserve original token correlation, create a per-token attempt result, and revoke only invalid tokens. Parent rule: if any token accepts, mark push `sent` terminally and record remaining token failures without retrying that completed channel; if no token accepts and at least one outcome is retryable, retry only the push channel; if all outcomes are terminally invalid/failed, terminally fail it. Never retry a completed sibling channel.
8. Email: expose `sendModerationQueueEmail` through a reusable SMTP primitive with connection/greeting/socket timeouts and an overall deadline shorter than the renewable lease. Use the Expyrico palette, count-only escaped copy, and fixed queue link. Mock sender in tests.
9. On retryable failure, fence-update attempts/error/backoff; terminally fail at the max. Success/skip/terminal-fail write `completedAt` and clear lease ownership only through the fenced finalizer.
10. Add a lease-protected 90-day cleanup. Delete per-token attempts, deliveries, events, then batch in bounded FK-safe transactions only when every delivery is terminal. Never delete unbatched/pending/processing/retryable work.
11. Register worker/queue/watchdog/cleanup in `startWorkers` and `getAllQueues`; ensure orderly stop. Add durable health state and authenticated visibility for last successful tick/recovery/cleanup/reconciliation, oldest unbatched/due-work age, and outcome/deletion counters. Log only safe IDs/counters/error class.

## Success Criteria

- [ ] Scheduler registration is stable across worker boots, and the watchdog re-registers/recoveries after Redis loss without a process restart.
- [ ] A tick with no fresh events creates no batch and makes no FCM/SMTP calls; no-admin batches terminally record zero recipients and emit health state without deferred replay.
- [ ] A tick aggregates all event kinds correctly and creates exactly two unique delivery rows per active-admin snapshot.
- [ ] Two concurrent ticks, an expired lock, or a retry cannot assign one occurrence to two batches or allow a stale delivery owner to alter a reclaimed row.
- [ ] A queue/process crash, Redis flush, or hung SMTP/FCM invocation does not lose work; token-fenced recovery follows safe bounded at-least-once semantics.
- [ ] Push no-token, invalid-token, partial token success, >500 tokens, total FCM outage, SMTP timeout/outage, disabled template, inactive/demoted admin, sibling-channel failure, and terminal retry exhaustion produce correct durable outcomes.
- [ ] FCM/email content is count-only, template text is escaped, and all links resolve from canonical `cfg.frontend.adminUrl` to `/products/pending`.
- [ ] A 90-day cleanup deletes only fully terminal batch history, including child token attempts, and never deletes unbatched events or retryable deliveries.
- [ ] Existing expiry reminder and giveaway notification tests remain unchanged and pass.
- [ ] Focused unit/integration tests, API typecheck, watchdog/health checks, and worker queue registration checks pass.

## Risk Assessment

- **Exactly-once misconception:** provider API calls cannot be atomically committed with PostgreSQL. Implement durable at-least-once semantics, deadlines, fenced ownership, bounded retries, and transparent per-token/channel history; do not promise exactly-once push/email.
- **Redis flush removes scheduler:** the lifecycle-managed watchdog executes durable work and reconciles `upsertJobScheduler` while workers remain alive; health reports stalled tick/recovery age.
- **Stale worker result:** lease-owner conditional claims/renewals/finalizers prevent an expired/reclaimed sender from overwriting later state.
- **FCM expansion over many devices:** deterministic ≤500-token chunks, per-token result rows, and retry classification prevent an oversized multicast call from failing the whole recipient.
- **Email route overlap:** preserve authentication email behavior while extracting a timeout-configured primitive; moderation template HTML is escaped and gets one server-owned link.
