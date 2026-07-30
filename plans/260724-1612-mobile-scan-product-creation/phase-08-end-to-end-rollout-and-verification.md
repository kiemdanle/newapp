---
phase: 8
title: "End-to-end rollout and verification"
status: pending
priority: P1
effort: M
dependencies: [5, 6, 7]
---

# Phase 8: End-to-End Rollout and Verification

## Context Links

- [Plan overview](./plan.md)
- [Approved design](../../docs/superpowers/specs/2026-07-24-mobile-scan-product-creation-design.md)
- [Android reliability plan](../../docs/superpowers/plans/2026-07-22-android-scan-passkey-reliability.md)

## Overview

Run exact automated, fault, infrastructure, restore, and physical-device gates; provision before API startup; dark-deploy lookup v2 with server mode off; enable internal cohort for 24 hours; and require numeric go/no-go thresholds plus rollback drill before general release.

## Requirements

- Expand/classify migrations only: add enum/schema support without changing row meaning, deploy compatible readers/writers, drain older API instances, then classify legacy report-hidden rows in a second migration. No enum rename/drop, destructive rollback, or pre-compatibility row sweep.
- Provision directories/secrets/config/nginx before starting API fail-fast checks.
- Legacy lookup preserves its response/status envelope but uses active-only local visibility; v2 mobile ships before internal mode.
- Internal cohort = admin users plus configured UUID allowlist.
- Observation window = minimum 24 hours and 20 successful submissions, whichever takes longer.
- Go/no-go for that window:
  - zero unauthorized private metadata/media exposures;
  - zero DB rows referencing missing media;
  - disk ≥20% free and no hard-stop event;
  - API 5xx ≤2%; assessment provider failures ≤5%;
  - oldest pending moderation ≤24h;
  - cleanup and backup success age ≤26h;
  - no unresolved verified P1/P2 correctness/security finding.

## Implementation Steps

### Task 1: Contract/static audit

- [ ] Map each plan acceptance item to exact source/test. Verify statuses/outcomes/routes/error fields/config/path/mode names.
- [ ] Search for old blanket scan catch, direct private product existence/FK checks (including record PATCH/sync), path-only idempotency, report auto-hide writes to creator `pending`, public aliases outside `public/`, direct `process.env` outside config, bearer private URLs, unscoped native private-image caches, and client `imageUrl` creation.
- [ ] Run `git diff --check` and repository secret scan. Expected: clean.

### Task 2: Exact automated gates

- [ ] Shared/DB:

```bash
pnpm --dir packages/shared test
pnpm --dir packages/shared typecheck
pnpm --dir packages/shared build
pnpm --dir api exec prisma validate
pnpm --dir api db:generate
```

- [ ] API:

```bash
pnpm --dir api test:unit
pnpm --dir api test:integration
pnpm --dir api typecheck
pnpm --dir api build
```

`api lint` is intentionally not a gate because the current script is `echo skip`; report it rather than pretending lint ran.

- [ ] Mobile:

```bash
pnpm --dir apps/mobile test
pnpm --dir apps/mobile lint
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile android:build
rm -rf /tmp/expyrico-mobile-bundle && mkdir -p /tmp/expyrico-mobile-bundle
pnpm --dir apps/mobile exec react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/expyrico-mobile-bundle/index.android.bundle --assets-dest /tmp/expyrico-mobile-bundle/assets
```

- [ ] Admin:

```bash
pnpm --dir apps/admin test
pnpm --dir apps/admin test:e2e -- tests/e2e/product-moderation.spec.ts
pnpm --dir apps/admin lint
pnpm --dir apps/admin typecheck
pnpm --dir apps/admin build
```

- [ ] Infra:

```bash
bash -n infra/scripts/backup.sh infra/scripts/restore.sh
# Run shellcheck when installed; absence is reported.
# Run the repo's verified ansible-playbook --syntax-check inventory/playbook form.
# Render both API/CDN vhosts and run nginx -t in the validation host/container.
```

- [ ] Provision the documented `pantry_app` test DB role before broad API integration, or report exact suites blocked by that known external prerequisite. Record every pass/fail/skip honestly.

### Task 3: Concurrency/fault matrix

- [ ] Same identifier creates (same/two users), external persistence race, cross-user idempotency key, changed body key, concurrent key, record sync/private product, and household use.
- [ ] Concurrent autosave/upload/reorder, photo quota, upload and whole-publication capacity reservation/heartbeat, Sharp semaphore/deadline, stream abort, decode fail, `SIGKILL` after each final private/public file creation before reference commit, DB/audit fail, prepared-intent expiry/recovery, outbox wake/process crash, cleanup fail.
- [ ] Concurrent admin correction versus revision rebase/supersede, retained-photo deletion guard, opposite-direction merge, atomic barcode/QR transfer, backup freeze during upload/delete/approval/cleanup, restore manifest mismatch, staging-restore validation failure, and paired cutover rollback.
- [ ] Expected: typed conflict/retry, no private exposure, no duplicate execution, no broken order/reference, compensation/alert signal.

### Task 4: Provision, expand/classify, and dark deploy

- [ ] Take verified predeploy DB/media backup. Provision private/public/quarantine roots, permissions, Google credentials/settings, internal allowlist, mode off, health/alerts, and API/CDN nginx/certificate first.
- [ ] Apply Phase 1 migration A only: add enum/schema support and default-off `product_creation` without changing existing product statuses. Deploy Phase 1 compatibility API/admin readers that parse both legacy report-hidden `pending` and `report_hidden`, while report writers intentionally continue emitting legacy `pending`. Keep creator submission disabled. Prove mixed-version behavior in staging, then fully drain/stop every pre-compatibility API instance.
- [ ] After every pre-compatibility API process is gone, deploy Phase 2 API instances that make legacy lookup active-only and switch report auto-hide/resolution writers to `report_hidden`; all overlapping Phase 1 compatibility instances can parse that value. Drain the Phase 1 writer fleet, verify no report writer still writes legacy `pending`, creator submission has remained disabled, and no pending row has a submission/private-draft marker; then apply migration B. Classify every remaining pre-feature `pending` product as `report_hidden`, including legacy report-hidden rows that retain a creator ID, and verify zero `pending` products remain before enabling creator submission. Deploy the remaining API support/start fail-fast checks, then mobile lookup v2. Only now may creator submission use `pending`. Legacy lookup retains its envelope but returns exact non-active rows as legacy 404; legacy create returns `upgrade_required` and inserts nothing in every mode.
- [ ] If enum-addition transaction rules on the deployed PostgreSQL version require it, run enum addition as its own committed migration before any migration/reader writes `report_hidden`; prove this exact order in staging.
- [ ] Controlled photo: private bytes authorized; CDN 404 preapproval; fresh public UUID + immutable bytes postapproval; backup includes referenced private/public and excludes quarantine.

### Task 5: Android physical-device smoke

- [ ] Install on MI 9 using known MIUI adb workaround as required; record builds.
- [ ] Existing hit; unavailable Retry/Scan again only; full miss Create/Scan again; creator private resume; another-user under-review without metadata + custom unlinked pantry.
- [ ] Name/description/brand/category; camera/gallery/crop/rotate; progress/cancel/retry; reorder/cover/remove/five cap; dirty-exit prompt; kill/relaunch/user-switch isolation. Explicitly fetch A's private photo, log out, sign in as B, and prove no cached file/URI/bytes cross the account boundary.
- [ ] Prove a `draft` cannot be attached by REST/sync; submit zero/multiple photos with Enterprise token; immediate personal AddRecordForm; existing personal reference remains while changes are required but cannot move to household; other user cannot read/fetch/use; admin changes/resubmit/approve; active lookup/public media.
- [ ] From active product detail, create/resume a mobile revision, change metadata and retained/staged photo order, submit with creation mode off, verify live catalog remains unchanged, then exercise request changes/resubmit/approve. After a conflicting admin correction, exercise explicit rebase or supersede recovery.

### Task 6: Admin/iOS/restore/cleanup smoke

- [ ] Admin queue/filter/diff/product-and-staged-edit private proxy/approve/request-change/correction/order/remove/merge/conflict/rebase/supersede/audit.
- [ ] iOS exact native compile/runtime attempt. Existing external signing/host blocker is captured; dependency compile errors block.
- [ ] Disposable restore uses staging DB plus staging media, validates manifest/checksums/row paths/private auth/public bytes before coordinated cutover, and proves rollback keeps the prior paired generation. Cleanup dry-run then live deletes only seeded eligible data.

### Task 7: Internal 24-hour gate and rollback drill

- [ ] Set mode `internal`; confirm noncohort direct API is rejected. Observe for at least 24h and 20 submissions.
- [ ] Evaluate every numeric threshold above. Any privacy leak, missing referenced media, disk hard stop, stale backup/cleanup, or unresolved P1/P2 blocks release and returns mode off.
- [ ] Rollback drill: mode off; active lookup/scanning/custom pantry/approved media still work; existing drafts readable but immutable; no schema/data deletion.
- [ ] Set `all` only after successful restore, moderation cycle, review, and thresholds.

### Task 8: Completion evidence

- [ ] Update only verified existing docs/roadmap/changelog requirements. Keep plan/status artifacts out of application commits.
- [ ] Obtain required Codex and Z.ai GLM 5 quality inspections; apply only verified findings with tests.
- [ ] Re-run owning focused suite plus full relevant gate after review fixes.
- [ ] Mark phase state through `ck plan check` separately from application commits.

## Success Criteria

- [ ] All exact available commands pass; no no-op lint/test is reported as validation.
- [ ] Android full flow, admin flow, backup/restore, cleanup, publication, and rollback pass.
- [ ] Legacy lookup clients remain safe during dark deploy; legacy active-product create is blocked and v2 creation mode is server-enforced.
- [ ] Internal observation meets all numeric gates for 24h/20 submissions.
- [ ] iOS status is accurate and no dependency compile defect is waived.
- [ ] No unresolved verified P1/P2 security/correctness finding remains.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Mixed-client unsafe behavior | Medium | High | High | separate v2, mode off, old-client test; rollback mode off | Release/API |
| Production privacy leak | Low | Critical | Critical | immediate mode off, preserve evidence/data, block all rollout | Security |
| Capacity/moderation overload | Medium | High | High | numeric gates and 24h cohort; mode off on threshold | Ops/Product |
| Restore inconsistency | Low | Critical | Critical | manifest drill required before all mode | Ops |
| False green from skipped/no-op gate | Medium | Medium | Medium | exact command log and explicit skips | Release |
