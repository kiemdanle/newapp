---
phase: 7
title: "Operations abuse controls and cleanup"
status: pending
priority: P1
effort: L
dependencies: [2, 3, 4]
---

# Phase 7: Operations, Abuse Controls, and Cleanup

## Context Links

- [Plan overview](./plan.md)
- Config: `api/src/config.ts`
- Workers: `api/src/queues/index.ts`, `api/src/workers/runner.ts`
- Deployment: `infra/roles/nginx/templates/api.vhost.j2`
- Backup/restore: `infra/scripts/backup.sh`, `infra/scripts/restore.sh`
- Google docs: reCAPTCHA Enterprise Mobile SDK and CreateAssessment mobile API

## Overview

Finalize the blocking abuse-verification contract, enforce server rollout modes and per-user quotas over Phase 3 atomic storage reservations, schedule safe cleanup in the existing BullMQ layout, provision a dedicated `cdn.expyrico.app` public-only vhost, and establish a consistent database/media backup boundary with restore validation.

## Requirements

- Google reCAPTCHA Enterprise Mobile SDK; action `submit_product`; server CreateAssessment verifies valid token, exact action/site key/app registration, score ≥0.5, and records risk reasons/assessment name safely. Invalid/low score denied; provider timeout/error retryable.
- Current documentation baselines Android SDK 18.8.0 and iOS 18.9.0+; implementation rechecks/pins exact current versions. Phase 5 owns mobile bridge.
- Authoritative DB/admin setting key `product_creation` has validated value `{ mode: 'off' | 'internal' | 'all' }`. Phase 1 expand migration A guarantees `{ mode:'off' }` exists before API startup. Internal = admin role or user ID listed in validated environment allowlist. API capability response is actor-specific.
- Mode gates lookup-v2 `not_found.canCreate` plus private new-product draft create/metadata/photo/submit mutations. When off, existing drafts remain readable/exportable but those mutations return typed feature-disabled. Admin moderation of already pending products and ordinary active-product revisions remain available. Legacy `POST /v1/products` stays blocked in every mode.
- Phase 3 atomic global disk-byte reservations cover uploads and every final-byte allocation, including a whole product/revision publication set. This phase adds per-user/day quotas, stale-owner reconciliation, health signals, and hard-stop policy without replacing the Phase 3 implementation. Active operations heartbeat reservations/intents/media leases; a bounded total deadline is shorter than maximum lease lifetime, and reconciliation never frees bytes still owned by a live heartbeat. Sharp semaphore comes from Phase 3.
- Cleanup only draft >30 days/no record/edit reference, stale quarantine, and proven orphan media. No nonexistent retention marker.
- Dedicated CDN vhost aliases only `/var/lib/expyrico/media/public/products/`.
- Backup establishes a media-mutation/cleanup freeze, captures DB+media manifest/snapshot boundary, verifies every referenced key, then releases freeze. Quarantine excluded.
- Concrete monitoring uses existing log/UptimeRobot foundation plus a protected operational health endpoint and systemd timer failure alerts; no new full metrics stack.

## Related Code Files

- Consume: Phase 1 `packages/shared/src/schemas/admin/settings.ts` contract
- Modify: `api/src/services/admin/settings.ts`
- Modify: admin settings route/UI files for feature mode
- Modify: `api/src/config.ts`
- Create: `api/src/services/abuse/product-creation-assessment.ts`
- Create: `api/src/services/products/product-creation-eligibility.ts`
- Create: `api/src/services/products/product-creation-quotas.ts` (per-user draft/day policy consuming Phase 3 capacity reservations)
- Modify: `api/src/services/products/product-media-capacity.ts` (operational reconciliation/metrics only)
- Create: `api/src/services/products/product-media-cleanup.ts`
- Create: `api/src/queues/jobs/product-media-cleanup.ts`
- Modify: `api/src/queues/index.ts`
- Modify: `api/src/workers/runner.ts`
- Modify: Phase 2 product mutation routes/services and Phase 3 upload reservations
- Create/modify: protected operational health route following current health route convention
- Test: `api/src/services/abuse/product-creation-assessment.test.ts`
- Test: `api/tests/integration/product-creation-mode.test.ts`
- Test: `api/tests/integration/product-creation-abuse.test.ts`
- Test: `api/tests/integration/product-media-cleanup.test.ts`
- Modify: `infra/group_vars/all.example.yml`
- Modify: `infra/roles/app/tasks/main.yml`
- Modify: `infra/roles/app/templates/pantry-api.service.j2`
- Modify: `infra/roles/nginx/tasks/main.yml`
- Modify: `infra/roles/nginx/handlers/main.yml`
- Create: `infra/roles/nginx/templates/cdn.vhost.j2`
- Modify: `infra/roles/certbot/tasks/main.yml`
- Modify: `infra/site.yml`
- Modify: `infra/scripts/backup.sh`
- Modify: `infra/scripts/restore.sh`
- Modify: relevant existing deployment/operations docs
- Do not modify: `apps/mobile/**` (Phase 5 ownership)

## Implementation Steps

### Task 1: Lock provider contract and server assessment

- [ ] Recheck official current docs and exact native pins. Consume Phase 1's required shared `abuseToken` submit field and communicate exact pins/action/site-key requirements to Phase 5.
- [ ] Add `@google-cloud/recaptcha-enterprise` exact compatible server dependency or use REST with authenticated Google client already accepted by project; credentials remain environment/service-account managed.
- [ ] Test valid expected action/site key/score, wrong action/key/app registration signal where returned, invalid/reused/expired token, score 0.49, risk reasons, provider timeout, secret/log redaction, and cached singleton client.
- [ ] Implement CreateAssessment with bounded timeout. Return allowed only for valid + exact action + score ≥0.5; provider failure is retryable, never accepted.
- [ ] Run `pnpm --dir api test -- src/services/abuse/product-creation-assessment.test.ts`.
  Expected: PASS.

### Task 2: Implement actor-specific server mode

- [ ] Consume Phase 1's `productCreationSettingsSchema`; extend API/admin settings service, route, and UI/actions for key `product_creation`. Add startup/integration proof that the Phase 1 migration supplied parseable `{ mode:'off' }` without running `seed-admin`. Validate internal allowlist UUIDs in `api/src/config.ts`.
- [ ] Test each actor/mode across lookup-v2 `canCreate`, legacy create, private draft create/update, photo operations, and submit. Existing draft read and pending moderation remain; ordinary active-product edit create/update/submit remains available in all modes. Legacy create returns `upgrade_required` in every mode.
- [ ] Implement `assertProductCreationEligible(actor, operation)` only on private new-product draft mutations. Capability endpoint/lookup response exposes only the actor's boolean eligibility, not the allowlist. Do not invoke it from active-product revision routes or admin moderation routes.
- [ ] Run `pnpm --dir api test -- tests/integration/product-creation-mode.test.ts`.
  Expected: PASS.

### Task 3: Per-user quotas and operational capacity reconciliation

- [ ] Consume the already fault-tested Phase 3 `reserveMediaCapacity` service; do not reimplement upload/publication reservation or lease semantics in this phase.
- [ ] Test per-user active-draft count, daily accepted/failed bytes, quota boundaries, admin/internal/all cohorts, and reconciliation metrics over Phase 3 reservations. Include interrupted owners and concurrent multi-photo approvals to prove the operational reconciler never reclaims a reservation or prepared intent with a live heartbeat.
- [ ] Implement per-user/day quota policy before Phase 3 reservation calls, plus bounded reconciliation for stale reservations/intents after checking producer heartbeat and DB/file state. Expose reserved/actual/stale counters to the health service.
- [ ] Run Phase 3 capacity/publication suites plus `pnpm --dir api test -- tests/integration/product-creation-abuse.test.ts`.
  Expected: PASS with unchanged Phase 3 concurrency guarantees.

### Task 4: Safe scheduled cleanup in existing worker layout

- [ ] Test stale/fresh quarantine, referenced/unreferenced private/public/staged key, draft >30d, exactly 30d, personal record reference, pending/changes-required/active/merged, open edit, unlink failure, overlap lock, and repeat idempotency.
- [ ] Implement bounded dry-run-capable passes. Recheck DB references/state immediately before deletion. Draft deletion condition is exactly draft + older than 30d + no record + no open edit. Consume Phase 1 `MediaOperationOutbox` with transactional claim (`FOR UPDATE SKIP LOCKED`), lease expiry, idempotent execution, retry/backoff, last-moment reference recheck, and terminal counters.
- [ ] Register `api/src/queues/jobs/product-media-cleanup.ts` in `api/src/queues/index.ts` and `api/src/workers/runner.ts` with one-overlap lock, batch limit, backoff, and structured counters. Polling the durable outbox is authoritative; BullMQ delivery only accelerates it.
- [ ] Run cleanup test twice.
  Expected: PASS.

### Task 5: Provision dedicated public CDN safely

- [ ] Identify exact current role files, then add media directories on same filesystem with API least-privilege ownership and nginx read permission only on public tree.
- [ ] Add dedicated `cdn.expyrico.app` vhost/certificate configuration. Alias only `/var/lib/expyrico/media/public/products/`; autoindex off; deny dot/temp/private/quarantine; `image/webp`, nosniff, immutable caching.
- [ ] Render Ansible and run syntax plus `nginx -t` in validation container/host. Assert API-origin/private tree cannot be fetched from CDN.
- [ ] Provision directories/config before starting an API that validates them.

### Task 6: Consistent backup/restore boundary

- [ ] Extend Phase 3's DB/Redis `withMediaMutationLease` adapter with backup-freeze acquisition, covering upload final promotion, publication plus DB key/intent commit or compensation, photo delete/reorder outbox insertion, admin correction/merge media mutations, prepared-intent recovery, and outbox/sweeper cleanup. Freeze acquisition atomically blocks new leases, waits for all lease IDs to drain, then permits the backup boundary; operations racing with freeze finish under an existing heartbeating lease or receive a typed retry. Expiring leases plus reconciliation handle worker/process death, and the backup trap always releases the freeze.
- [ ] Extend `backup.sh`: acquire freeze; wait for in-flight operations; create PG dump; generate referenced-media manifest/checksums; snapshot/archive final private+public media excluding quarantine/temp; verify every DB key in manifest; package DB dump, media, and manifest as one backup generation; publish restic/age+rclone artifact only after verification; release freeze.
- [ ] Redesign `restore.sh` around staging, not direct `pg_restore --clean` to live. Preserve explicit destructive/operator confirmation, create a staging database and staging media root, restore both backup resources there, verify checksums/row references and sample-decode WebP, then enter maintenance mode and perform a coordinated DB+media cutover. Retain rollback DB/media copies/generation pointers until post-cutover health succeeds; a validation failure must leave live DB and live media untouched.
- [ ] Fault-test upload promotion/delete/reorder, product and revision approval, admin photo correction, merge cleanup scheduling, and outbox/sweeper cleanup racing with freeze; prove no DB-referenced key changes between completed drain and manifest capture. Also test process death/lease expiry/reconciliation and script failure/trap release.
- [ ] Fault-test staging DB restore success followed by media checksum/reference/decode failure, cutover failure after one resource switch, and health-check failure. Each path must restore or preserve the prior paired DB/media generation; never leave production pointing at unpromoted bytes.
- [ ] Run `bash -n infra/scripts/backup.sh infra/scripts/restore.sh`, ShellCheck when installed, disposable source→staging DB/media backup, validated cutover, and rollback verification.
  Expected: consistent restored references; quarantine absent; live resources unchanged on pre-cutover failure.

### Task 7: Concrete operational signals/docs

- [ ] Protected health payload reports free bytes/percent, reserved bytes, reserve status, cleanup last success/failure/oldest quarantine, pending count/oldest age, and backup last success. UptimeRobot/systemd checks alert non-2xx or stale timestamps.
- [ ] Numeric alert defaults: free disk <20% warning, <15% hard stop/reserve; oldest pending >24h warning; cleanup success older than 26h; backup success older than 26h; assessment provider failures >5%/15m; API 5xx >2%/15m; upload validation rejection >25%/15m for investigation (not automatic block).
- [ ] Document formats, paths, mode/internal allowlist, SDK pins, cleanup dry-run/live, backup/restore/freeze, signals, and rollback.
- [ ] Run API tests/typecheck, rendered infra checks, backup/restore drill.

### Task 8: Commit boundary

- [ ] Commit after PASS:

```bash
git add api/src api/tests apps/admin infra docs pnpm-lock.yaml
git commit -m "feat(products): add media operations and abuse controls"
```

## Success Criteria

- [ ] Server verifies Enterprise token/action/key/score and fails conservatively.
- [ ] Mode supports off/internal/all with direct API enforcement and known cohort.
- [ ] Phase 3 atomic heartbeating reservations remain the single upload/publication capacity implementation; Phase 7 quotas/reconciliation cannot expire them beneath active work.
- [ ] Cleanup uses durable outbox plus existing worker integration and preserves protected references across process failure.
- [ ] Dedicated CDN exposes only immutable public namespace.
- [ ] Backup freeze/manifest and staging restore/cutover/rollback drill prove DB/media referential consistency.
- [ ] Concrete health thresholds and alerts are documented/tested.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Provider outage blocks submit | Medium | Medium | Medium | retryable response; mode off if prolonged | API/Ops |
| Concurrent disk exhaustion | Medium | Critical | Critical | atomic global reservation + hard 15% stop | API/Ops |
| Cleanup deletes referenced file | Low | Critical | Critical | reference recheck/dry run/backup; stop worker on anomaly | Ops/API |
| Inconsistent backup | Medium | Critical | Critical | freeze + manifest validation; backup not successful otherwise | Ops |
| CDN private leak | Low | Critical | Critical | dedicated public-only alias and fetch tests | Ops/Security |
