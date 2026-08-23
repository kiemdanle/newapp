---
phase: 4
title: Verify and document
status: completed
priority: P1
dependencies:
  - 1
  - 2
  - 3
---

# Phase 4: Verify and Document

<!-- Updated: Validation Session 1 — staging migration/watchdog proof, hardened failure-mode matrix, and application-only rollback. -->

## Overview

Run the focused and cross-workspace verification gates, exercise realistic concurrency/failure paths, and update architecture/deployment documentation to reflect the new worker, durable batch semantics, and operational recovery process.

## Requirements

- Functional:
  - Verify transactional event capture for both product and revision submission paths.
  - Verify one 15-minute batch produces the intended recipient/channel deliveries without repeat alerts for already batched events.
  - Verify retries/recovery/terminal-failure behavior without real FCM or SMTP calls.
  - Verify admin badge/history and mobile notification tap behavior.
  - Document operator-visible worker behavior, queue health, retention, rollout, and rollback.
- Non-functional:
  - Run narrow tests first, then broaden only after dependencies and contracts are green.
  - Treat the current deploy source—not stale documentation—as authoritative: require production-equivalent staging migration/schema/template/watchdog proof before rollout.
  - Keep tests deterministic: inject time, mock external FCM/SMTP, and use real Postgres/Redis only for database/queue concurrency semantics.

## Related Code Files

- Modify: `api/tests/helpers/setup.ts` and test database DDL helpers only if Phase 1 leaves schema setup gaps.
- Create/Modify: `api/tests/integration/moderation-notification-*.test.ts` — event, claim, retry, admin-system endpoint tests.
- Create/Modify: `api/tests/unit/moderation-notification-worker.test.ts` and email/push mocks — deterministic worker/channel cases.
- Modify: `apps/admin/tests/e2e/*moderation-notification*.spec.ts`, mocks, and fixture store — admin badge/history verification.
- Create/Modify: `apps/mobile/src/features/push/*.test.ts` — push open validation and listener lifecycle tests.
- Modify: `docs/system-architecture.md` — worker table, durable moderation batch pipeline, FCM/SMTP channel behavior.
- Modify: `docs/deployment-guide.md` — queue worker/health/operational recovery notes, production-equivalent staging migration proof, and application-only rollback procedure.
- Modify: `docs/project-roadmap.md` only if this feature introduces a durable known gap; remove or correct the stale migration-filter claim if it still appears there.

## Implementation Steps

1. Build a test matrix before broad execution. Cover the state transition source, batch creation/claim, recipient/channel delivery, recovery, UI, and mobile open surfaces independently so failures identify the broken invariant.
2. API integration tests using real Postgres/Redis:
   - successful draft submit/resubmit creates one versioned `new_product` occurrence;
   - successful revision submit/resubmit and pending-producing stale rebase each create one versioned `product_revision` occurrence;
   - failed/invalid/stale/already-pending/idempotent replay creates none;
   - parallel tick transactions cannot assign an event twice;
   - active/current-role vs suspended/deleted/demoted recipient checks follow policy; zero-recipient batch is terminal and health-signaled;
   - zero-event tick makes no batch; already-batched events make no second batch;
   - API summary/history/health is current-role-admin-only, paginated, ordered, redacted.
3. Worker unit tests with fake time and mocked FCM/SMTP:
   - stable scheduler registration and watchdog reconciliation after Redis flush without process restart;
   - aggregation counts and bounded page behavior;
   - disabled/invalid template, zero push tokens, per-token invalidation, partial success, and >500-token chunking;
   - SMTP deadline/hang/failure; retry schedule and max-attempt terminal result;
   - claim-token lease loss/crash recovery, stale `processing` reclaim, late original completion, and no stale-state overwrite;
   - count-only escaped email/push copy and canonical trusted queue URL construction.
4. Admin tests:
   - server-rendered pending count matches independent product/revision fixture rows;
   - badge remains accessible and links to `/products/pending` in desktop/sidebar-drawer contexts;
   - demoted-admin token is rejected; history/health filter/pagination works and exposes no private fields;
   - existing pending queue behavior still works.
5. Mobile/config tests:
   - canonical server/mobile origin config accepts production-safe values and rejects mismatch/HTTP/userinfo/fragment;
   - accepted moderation payload opens canonical HTTPS URL;
   - wrong type, HTTP, different origin, userinfo, fragment, path traversal/alternate path, malformed URL, and duplicate callback do not open arbitrary content;
   - pre-existing expiry message behavior is not changed.
6. Execute validation in increasing blast radius:

   ```bash
   pnpm --filter @expyrico/api test -- moderation-notification
   pnpm --filter @expyrico/api test -- workers-notification-send workers-notification-schedule products-draft-lifecycle product-edits
   pnpm --filter @expyrico/api typecheck
   pnpm --filter @expyrico/admin test:e2e -- <new-focused-spec>
   pnpm --filter @expyrico/admin build
   pnpm --filter @expyrico/mobile test -- --runInBand <push-focused-tests>
   pnpm --filter @expyrico/mobile typecheck
   pnpm -r typecheck
   pnpm -r test
   ```

   Adjust exact test-script arguments to the package scripts; report any suite unavailable in the environment rather than weakening coverage.
7. Run a production-equivalent staging gate using the current deploy command: run `prisma migrate deploy`, generate client, verify new tables/indexes/template, start workers/watchdog, flush/restart Redis without process restart, and prove scheduler reconciliation/DB recovery. Then submit one product, one user revision, and one pending-producing stale rebase; verify count-only push/email, channel/token history, trusted link, health records, and no alert on a later empty tick. Use test identities/tokens only.
8. Update architecture/deployment documentation with the queue, scheduler-independent watchdog, PostgreSQL source-of-truth/claim fencing, current-role authorization prerequisite, canonical server/mobile URL config, per-token FCM + SMTP deadline behavior, at-least-once caveat, health thresholds, 90-day terminal-history cleanup, and staging proof.
9. Default rollback is application-only: quiesce/drain scheduler/watchdog and delivery claims, deploy prior binary, retain additive schema and data. Do not drop tables as ordinary rollback. If exceptional schema reversal is required, document audited Prisma migration-ledger/backup restoration, prove all work is quiesced, and prove the next forward deployment recreates schema.

## Test Scenario Matrix

| Scenario | Test layer | Expected result |
|---|---|---|
| New product submission succeeds | API integration | One `new_product` event; later one aggregate batch |
| Revision resubmission or pending rebase succeeds | API integration | One versioned `product_revision` occurrence; no product event |
| Submission fails/stales/replays | API integration | No event/batch/delivery side effect |
| Multiple API workers schedule | Unit + integration | One durable scheduler/one batch assignment per occurrence |
| Redis flush while workers stay live | Worker integration | Watchdog re-upserts schedule and drains durable work |
| Batch has no fresh events | Worker unit | No rows and no provider call |
| Recipient loses admin access | Integration + worker | Excluded at snapshot or skipped before send; demoted token rejected |
| FCM token invalid/partial or >500-token result | Worker unit | Chunked token outcomes, correct revoke/outcomes, bounded retry only where appropriate |
| SMTP timeout after batch commit | Worker unit | Deadline, fenced recovery, no stale-state overwrite |
| Process dies mid-delivery | Integration/unit lease test | Token-fenced recovery reclaims expiry; possible bounded duplicate only at provider edge |
| Existing backlog stays open | Integration + UI | No later notification absent fresh event; badge/queue displays backlog |
| Unsafe mobile config/payload | Mobile Jest | No external URL opened |

## Success Criteria

- [ ] All Phase 1–3 acceptance criteria have automated coverage or an explicitly documented, reproducible manual gate.
- [ ] Tests prove no notification flood under many submissions, concurrent schedulers, queue retries, or an unresolved backlog.
- [ ] Tests prove events/deliveries are not lost when queue/provider failures occur after the product/revision status transition.
- [ ] New admin/mobile behavior passes without regression to existing moderation, expiry notification, auth-email, or navigation tests.
- [ ] API/admin/mobile typechecks and selected builds pass; full workspace results are recorded faithfully.
- [ ] Docs accurately describe production scheduling/watchdog, observability, retention, application-only rollback, trusted URL configuration, and the staging migration proof gate.
- [ ] No secrets, actual device tokens, email addresses, raw provider payloads, or private moderation/product data appear in test fixtures, logs, or documentation.

## Risk Assessment

- **Flaky time-based tests:** pass an explicit clock into batch/lease helpers; avoid real sleep or global system-time mutation where practical.
- **Real provider delivery during test:** use module mocks and test config guards. Manual smoke uses approved non-production SMTP/FCM credentials only.
- **Staging false positive:** CI may pass without proving deploy wiring, Redis reconciliation, or real migration order. Require the production-equivalent staging migration/schema/template/watchdog proof before rollout.
- **History cleanup:** retain 90 days of terminal batch history; cleanup must preserve every unbatched event and any pending/processing/retryable delivery, run in bounded foreign-key-safe transactions, and log deletion counters.
