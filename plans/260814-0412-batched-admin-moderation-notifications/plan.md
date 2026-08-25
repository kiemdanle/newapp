---
title: Batched admin moderation notifications
description: >-
  Deliver one durable 15-minute push and email summary to active admins when new
  products or revisions enter the moderation queue.
status: pending
priority: P1
branch: main
tags:
  - feature
  - backend
  - database
  - notifications
  - api
  - admin
  - mobile
blockedBy: []
blocks: []
created: '2026-08-14'
---

# Batched Admin Moderation Notifications

## Overview

Notify every active admin when **new creator product submissions** or **active-product revisions** enter moderation. A 15-minute server-side batch aggregates only arrivals not included in an earlier batch, then creates independent push and email delivery records for the active-admin recipient snapshot.

The summary has one purpose: route admins to the existing unified moderation queue at `/products/pending`. It reports counts only—no creator PII, product names, private photos, tokens, or moderation data. It does not re-alert merely because a backlog remains unresolved; the existing admin queue, new badge, and delivery-history view make backlog state visible.

## Confirmed decisions

- **Cadence:** every 15 minutes, server-side.
- **Sources:** new products (`Product.status` transition to `pending`), user resubmissions, and stale revision rebases that return `ProductEdit` to `pending`.
- **Scope:** notifications cover both sources and only fresh arrivals; no recurring backlog reminders.
- **Event identity:** an event represents one successful transition occurrence and is unique by `(kind, sourceId, submissionVersion)`, where the guarded transition increments `submissionVersion` atomically.
- **Recipients:** snapshot users whose *database* role is `admin` and status is `active`; a recipient is re-checked against the current database role/status before delivery. A zero-recipient batch is terminally handled and emits a health signal, not a later replay.
- **Channels:** FCM push plus email to each recipient. A missing/revoked device token records push as skipped; email still proceeds. Each FCM token has its own durable result, and a successful channel is never retried when the other fails.
- **Navigation:** server and mobile use a canonical, HTTPS-only, credential-free admin origin. The API derives `/products/pending` from `cfg.frontend.adminUrl`; mobile validates against independently configured `MOBILE_ADMIN_URL` before opening it.
- **Reliability:** submission events are persisted in the same database transaction as the authoritative status transition. Batch assignment and delivery records are durable and claim-token-fenced. A lifecycle-managed DB-authoritative watchdog progresses and recovers work even after Redis scheduler state is lost. Provider delivery is at-least-once; deadlines, lease renewal, fenced finalizers, and bounded retry prevent retry storms.
- **Templates:** seed one editable `moderation_queue` notification template. Its title/body are bounded plain text with only `{newProducts}`, `{revisions}`, and `{total}` placeholders; rendered HTML escapes all text and constructs the sole queue link server-side. Existing templates retain their own placeholder rules.
- **Retention:** retain completed batches, their events, per-token results, and terminal delivery records for 90 days; a scheduled cleanup deletes only fully terminal history.
- **Rollout/rollback:** require production-equivalent staging migration and watchdog proof before rollout. Application-only rollback is default; retain the additive schema/data.

## Architecture

```text
submitDraft / submitProductEdit
  └─ transaction: state -> pending + versioned moderation_notification_event
      (includes user submit/resubmit and pending-producing stale rebase)
                                      │
BullMQ 15-minute scheduler             ▼
  └─ moderation-batch worker ──> lock/claim unbatched events
                                   ├─ moderation_notification_batch
                                   └─ recipient × channel delivery rows
                                                     │
                                  durable dispatcher/recovery scan
                                  ├─ FCM worker -> per-token outcome + delivery state
                                  └─ SMTP worker -> delivery state
                                                     │
                            admin badge/history + email/push link
                                      -> /products/pending
```

A dedicated moderation-notification pipeline is required. The existing `notification-send` worker is record-specific: it loads an active `Record`, requires `recordId`, and its `PushLog` model only optionally relates to records. Reusing it for product moderation would silently no-op or overload giveaway payload semantics. Existing `NotificationOutbox` is likewise giveaway-shaped and currently dispatches its payload through the record worker. This feature keeps those paths unchanged.

Use BullMQ 5's idempotent `Queue.upsertJobScheduler()` with a stable scheduler ID and `{ every: 900_000 }`. A lifecycle-managed unref'd watchdog also invokes the DB-authoritative tick/recovery primitive and re-upserts the scheduler, so progress survives Redis state loss without a process restart. PostgreSQL claims use `FOR UPDATE SKIP LOCKED`; delivery claims/finalizers include a random `leaseOwner` token; and unique event, delivery, and per-token-attempt keys make concurrency safe. A recovery pass reclaims only expired, token-fenced due work after a process/queue failure.

## Cross-plan dependencies

| Relationship | Plan | Status | Rationale |
|---|---|---|---|
| Relies on completed capability | `260724-1612-mobile-scan-product-creation` | completed | Provides the `draft/changes_required -> pending` product and revision transitions plus the unified moderation queue. |
| No blocking edge | `260714-0728-mobile-bare-rn-migration` | pending | The FCM registration base exists on `main`; this plan adds only notification-open behavior. |
| No blocking edge | `260712-0821-password-reset-otp` | pending | Auth/email helpers overlap only superficially; no contract dependency. |

## Phase roadmap

| Phase | Name | Status | Depends on | Primary validation |
|---|---|---|---|---|
| 1 | [Persist batch state and templates](./phase-01-persist-batch-state-and-templates.md) | Pending | — | Completed |
| 2 | [Schedule and deliver notifications](./phase-02-schedule-and-deliver-notifications.md) | Pending | 1 | Completed |
| 3 | [Expose admin observability](./phase-03-expose-admin-observability.md) | Pending | 1, 2 | Completed |
| 4 | [Verify and document](./phase-04-verify-and-document.md) | Pending | 1–3 | Completed |

## File ownership and expected change surface

| Area | Expected files | Owner phase |
|---|---|---|
| Schema and transactional event capture | `api/prisma/schema.prisma`, new migration, `product-drafts.ts`, `product-edits.ts`, API test setup/tests | 1 |
| Queue/worker/channel delivery | new `api/src/queues/jobs/moderation-notifications.ts`, new notification service files, `workers/runner.ts`, `queues/index.ts`, `services/auth/email.ts`, worker tests | 2 |
| Admin count, badge, history; mobile tap | shared admin schemas, admin API/routes/components/tests, mobile push-open handler/tests | 3 |
| Documentation and full validation | `docs/system-architecture.md`, test/validation artifacts only as needed | 4 |

Do not refactor expiry reminders, giveaway notifications, legacy `NotificationOutbox`, or existing product moderation behavior as part of this work.

## Acceptance criteria

- [ ] Every successful guarded transition to `pending`—new-product submit, user resubmit, and pending-producing stale rebase—persists exactly one versioned moderation event in the same transaction; invalid, stale, duplicate, or already-pending attempts create none.
- [ ] A 15-minute batch includes each unbatched event exactly once, aggregates new-product and revision counts separately, and either snapshots active database-current admins or terminally handles an auditable zero-recipient batch.
- [ ] Each recipient/channel has independent, claim-token-fenced delivery state, `completedAt`, bounded retries, and durable per-token FCM outcomes; a successful channel (including partial-token success) is never retried because its sibling or a failed token failed.
- [ ] FCM sends no product/creator details and chunks FCM multicast sends within the provider limit. Email is count-only, plain-text-template-derived, HTML-escaped, deadline-bounded, and contains only the canonical HTTPS moderation-queue URL.
- [ ] A provider, queue, process, or Redis scheduler failure does not discard events or cause an uncontrolled notification flood; DB-authoritative watchdog/recovery reclaims only token-fenced due delivery work.
- [ ] The sidebar/header displays the current pending queue count; history routes recheck database-current admin role; the system page exposes safe batch/delivery/pipeline health history.
- [ ] Mobile opening a moderation push accepts only the independently configured canonical HTTPS admin origin and exact queue path; non-moderation push behavior is unchanged.
- [ ] Production-equivalent staging migration, schema/template, scheduler-watchdog, and product/revision smoke proofs pass before rollout; Prisma generation/migration, API unit/integration tests, admin tests/build, mobile tests/typecheck, and workspace gates pass.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Concurrent schedulers duplicate a batch | Claim unassigned events with `FOR UPDATE SKIP LOCKED`; unique `(kind, sourceId, submissionVersion)` event identity and batch delivery/per-token constraints. |
| Queue enqueue or Redis scheduler state fails | Delivery rows remain durable; the DB-authoritative watchdog reclaims due work and re-upserts the scheduler without requiring process restart. |
| FCM/SMTP accepts a request but process dies before persistence | Use deadlines, lease renewal, stable correlation/message IDs, per-token outcomes, bounded retries, and token-fenced finalizers; document at-least-once provider delivery. |
| Template edit breaks counts or injects data | Apply keyed moderation-only placeholder validation after target lookup; reject markup/URLs; HTML-escape text and construct the sole link server-side. |
| Push opens an unsafe target | Require canonical HTTPS/no-userinfo server and independently configured mobile origins; client opens only the exact origin/path for the moderation notification type. |
| Demoted admin reads operational history | Fix admin authorization to use the database-current role or revoke token version on role removal before this endpoint ships. |
| Database performance or history grows | Add partial/indexed lookup paths, health-age indicators, and a 90-day cleanup for only fully terminal batch history. |
| A dashboard badge leaks queue data | Fetch through the existing API only after current-role admin authorization; render only in authenticated admin layout. |

## External reference

BullMQ Job Schedulers: https://docs.bullmq.io/guide/job-schedulers

## Red Team Review

**Review:** three hostile lenses; 15 evidence-backed findings deduplicated to 12 decisions. User approved all accepted corrections.

| Finding | Severity | Disposition | Plan change |
|---|---|---|---|
| Source-only event identity loses resubmissions | Critical | Accepted | Versioned occurrence key; rebase transitions included. |
| Scheduler disappears after Redis reset | High | Accepted | DB-authoritative lifecycle watchdog/reconciliation. |
| Stale delivery workers overwrite recovered work | High | Accepted | `leaseOwner` fenced claim/renew/finalize protocol. |
| Per-token FCM results cannot fit parent delivery row | High | Accepted | Durable token-attempt records plus provider-limit chunking. |
| Generic validator breaks existing templates | High | Accepted | Keyed post-lookup moderation-only validation. |
| Editable markup can inject links | High | Accepted | Plain-text moderation templates and escaped renderer with sole server-owned link. |
| Mobile/server trust anchor incomplete | High | Accepted | Canonical `cfg.frontend.adminUrl` + `MOBILE_ADMIN_URL` production contract. |
| Demoted admin keeps token role | High | Accepted | Current-role authorization/token invalidation prerequisite. |
| SMTP can outlive a lease | High | Accepted | Explicit deadlines plus lease renewal/fencing. |
| Missing terminal timestamp | Medium | Accepted | `completedAt` persisted on terminal finalizers. |
| Rollback drops tables while Prisma ledger remains | High | Accepted | Application-only rollback; exceptional reversal requires audited ledger/backup procedure. |
| Dead scheduler indistinguishable from idle system | Medium | Accepted | Durable pipeline-health timestamps/ages/counters. |

**Rejected as stale:** the old `@pantry/api` deployment-filter blocker. Current deploy source uses `@expyrico/api`; the plan now requires a production-equivalent staging migration and watchdog proof.

Report: [`reports/red-team-moderation-notification-plan-review.md`](./reports/red-team-moderation-notification-plan-review.md)

## Validation Log

### Session 1 — 2026-08-14
**Trigger:** User invoked `/ck-plan validate` after red-team review.
**Questions asked:** 8

#### Questions & Answers

1. **[Scope] If a batch runs while there are no active admins, should those fresh moderation events be considered handled or held until an admin is active?**
   - Options: Mark handled | Hold for admin | Escalate to operator
   - **Answer:** Mark handled
   - **Rationale:** Avoid delayed alerts for stale arrivals; retain an auditable zero-recipient batch and health signal.
2. **[Architecture] How should the mobile app know which admin-console URL is safe to open for a moderation push?**
   - Options: Dedicated public config | Push carries URL | No mobile opening
   - **Answer:** Dedicated public config
   - **Rationale:** `MOBILE_ADMIN_URL` gives mobile an independent trust anchor rather than trusting a payload-derived origin.
3. **[Tradeoff] When a batch’s push succeeds but its email fails (or vice versa), how should the delivery ledger behave?**
   - Options: Retry only failed channel | Retry both channels | Any channel enough
   - **Answer:** Retry only failed channel
   - **Rationale:** Avoid duplicate successful alerts while preserving attempted delivery on the failed channel.
4. **[Failure mode] If an admin disables or corrupts the moderation template before a batch runs, what should happen to that batch’s deliveries?**
   - Options: Skip and record | Retry until enabled | Use built-in fallback
   - **Answer:** Skip and record
   - **Rationale:** Do not defer or surprise-send old alerts after an operator re-enables the template.
5. **[Scope] A stale-revision rebase can move an edit back to `pending`. Should that transition enter the same fresh-arrival notification batch?**
   - Options: Notify on rebase | Suppress rebase alerts
   - **Answer:** Notify on rebase
   - **Rationale:** Rebased work is newly reviewable and must not create a silent moderation-queue arrival.
6. **[Security] Should the plan include prerequisite fixes for existing admin-role revocation and trusted admin-link configuration before exposing notification history or sending links?**
   - Options: Add both prerequisites | Role fix only | URL config only | Defer both
   - **Answer:** Add both prerequisites
   - **Rationale:** The new privileged history endpoint and privileged navigation must not amplify stale-role or unsafe-origin behavior.
7. **[Reliability] Should the plan add the full delivery-hardening bundle identified in review?**
   - Options: Add full hardening | Lease fencing only | Minimal retries
   - **Answer:** Add full hardening
   - **Rationale:** Claim fencing, deadlines, token chunks/audit, watchdog recovery, and health signals form one correctness boundary.
8. **[Rollout] Current deploy source uses `@expyrico/api`, while older docs say the migration filter is broken. What rollout gate should the final plan use?**
   - Options: Staging migration proof | Keep deploy blocker | Manual production check
   - **Answer:** Staging migration proof
   - **Rationale:** Current source wins over stale documentation; production-equivalent staging evidence is a stronger release gate.

#### Confirmed decisions

- No active admins: commit an auditable zero-recipient batch and mark its events handled; emit health signal, no delayed replay.
- Mobile trust: add independent public `MOBILE_ADMIN_URL`; enforce canonical HTTPS/no-userinfo server URL and production consistency check.
- Channel outcome: retry only the failed recipient/channel; never duplicate a successful sibling channel.
- Disabled/invalid moderation template: terminally skip and record current deliveries; do not delay them until template re-enables.
- Stale rebase: a rebase that returns an edit to `pending` is a new revision event and alert candidate.
- Security prerequisites: fix current-role admin authorization and canonical link configuration before new history/link delivery ships.
- Delivery hardening: implement lease fencing, SMTP deadlines/renewal, FCM ≤500-token chunks/per-token audit, watchdog recovery, and durable health signals.
- Rollout gate: source-verified staging migration/schema/template/watchdog proof, not the stale workspace-filter documentation.
- Terminal history retention: 90 days.

#### Impact on phases

- Phase 1: occurrence identity, rebase event capture, delivery-attempt/terminal data, and keyed safe-template validation.
- Phase 2: claim fencing, provider limits/deadlines, watchdog, health, and zero-recipient/retention behavior.
- Phase 3: current-role authorization, canonical URL/mobile config, health UI/API, and safe notification open.
- Phase 4: production-equivalent staging proof, application-only rollback, and expanded failure-mode tests.

### Verification Results

- **Tier:** Standard
- **Claims checked:** 40
- **Verified:** 39 | **Failed:** 1 | **Unverified:** 0
- **Failure resolved:** prior documentation claimed `@pantry/api` deploy filtering, while current `infra/scripts/deploy-remote.sh` uses `@expyrico/api`; replaced the false blocker with a staging proof gate.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, all four phase files.
- Decision deltas checked: 12 red-team corrections plus 9 validation decisions.
- Reconciled stale references: event identity, rebase scope, obsolete config accessor, generic template validation, startup-only scheduler, PushLog misuse, generic rollback, and obsolete deployment-filter blocker.
- Unresolved contradictions: 0.

## Unresolved questions

None.
