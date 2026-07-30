---
title: "Mobile scan product creation and moderation"
description: "Add conclusive scan-miss handling, creator-private product drafts, optional multi-photo upload on VPS storage, moderation, revisions, and immediate pantry continuation."
status: pending
priority: P1
effort: XL
branch: "main"
tags: [mobile, products, barcode, qr, media, moderation, api, admin]
blockedBy: []
blocks: []
created: "2026-07-24T09:14:02.503Z"
createdBy: "ck:plan"
source: skill
---

# Mobile Scan Product Creation and Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for each behavior change and `superpowers:verification-before-completion` before completion claims.

## Goal

After a conclusive barcode or QR lookup miss, let an authenticated mobile user create or resume a creator-private product with a required name, optional plain-text description, and up to five optional camera/gallery photos; submit it for moderation; then immediately add it to their pantry without exposing unapproved catalog data to other users.

## Architecture

Keep `Product` as the globally unique catalog identity and add explicit private lifecycle states, optimistic versioning, and ordered `ProductPhoto` rows. Product routes become thin adapters over product-domain services that centralize visibility, state transitions, conflicts, and media authorization. One-file multipart uploads stream to a quarantined VPS media root, Sharp generates metadata-free WebP variants, nginx serves only approved public variants, and private media stays behind authenticated API authorization.

The mobile scan path consumes explicit `found | editable_private | creator_pending | under_review | not_found | temporarily_unavailable` outcomes: `editable_private` is limited to creator-owned editable states, `creator_pending` is read-only with personal-pantry continuation, `under_review` reveals no other user's private metadata and never authorizes another draft, while `not_found.canCreate` is an actor-specific server capability rather than proof of eligibility. Draft creation independently repeats the conclusive lookup before reserving the identifier. The app then uses a resumable draft editor with one serialized product-mutation queue and independent local photo retry state. Existing admin product pages gain submission/revision moderation. Active-product creator edits continue through a versioned `ProductEdit` snapshot with staged/retained photo rows so live catalog data changes only after approval.

## Tech Stack

TypeScript, Zod 3, Fastify 4, Prisma 5/PostgreSQL, Redis/BullMQ, `@fastify/multipart` compatible with Fastify 4, Sharp, React Native 0.76.9 New Architecture, React Navigation 7, TanStack Query 5, `react-native-image-crop-picker` after native compatibility proof, Next.js 15, nginx, Ansible, restic or age+rclone backup.

## Source Design

- Approved specification: `docs/superpowers/specs/2026-07-24-mobile-scan-product-creation-design.md`
- Existing scan reliability design: `docs/superpowers/specs/2026-07-22-android-scan-passkey-reliability-design.md`
- Project contracts and conventions: `docs/code-standards.md`, `docs/system-architecture.md`, `docs/design-guidelines.md`

## Global Constraints

- Name required: trimmed 1–200 characters.
- Description optional: trimmed plain text, blank normalized to `null`, maximum 2,000 characters.
- Exactly one immutable scan identifier: barcode or QR payload.
- Offer creation only after a conclusive miss; upstream/network unavailability never implies not-found.
- Creator may use their private product only after abuse-verified submission: `pending` may be attached to a new personal record, and an existing personal reference may remain through `changes_required`; `draft` is never attachable. Other users cannot discover, read, attach, or fetch private media.
- Maximum five ordered photos; index 0 is cover.
- Physically separate `private/` and `public/` media namespaces; approval publishes a fresh immutable UUID object and never overwrites public bytes.
- Mobile private media uses authorized, account-scoped native requests/cache with logout/user-switch purge; admin media uses a parent-bound same-origin authenticated no-store proxy for product and staged-edit photos. Bearer tokens never appear in URLs.
- One file per multipart request; maximum 10 MB compressed upload; maximum 40 decoded megapixels.
- Accept JPEG/PNG and HEIC only when the deployed Sharp decoder proves support; reject SVG/GIF/video.
- Emit metadata-stripped WebP display (max 1600×1600) and thumbnail (max 480×480), no enlargement.
- Store media below `/var/lib/expyrico/media`, never inside a release checkout; all path segments server-generated UUIDs.
- Preserve `Product.imageUrl` only as a temporary cover compatibility projection.
- Product lifecycle: `draft → pending → active | changes_required`; `changes_required → pending`; eligible states may become `merged_into`. `report_hidden` is a distinct catalog-moderation state for reported active products and never means creator-submitted pending.
- Creator changes to active products use moderated `ProductEdit`; admins may edit directly.
- Product mutations require authenticated authorization, shared Zod validation, optimistic `version`, rate/byte quotas, and idempotency where retryable. Photo mutations (add/remove/reorder) require the same authorization, validation, and quotas, but never a client-supplied `version` precondition: Phase 5's independent per-photo retry design assumes none, and a per-product `FOR UPDATE` row lock plus a transactional `product.version` bump already prevent lost updates under concurrency — cross-client change detection still happens via the existing `version_conflict` path on the next *product* (metadata) mutation. Documented, reviewed deviation from this constraint's earlier wording (Phase 3 remediation, reviewer-p3 M4).
- Every final private promotion/public copy has a durable prepared `MediaOperationOutbox` intent before bytes are created; the reference transaction completes that intent atomically. Cleanup/publish compensation cannot depend on a post-commit BullMQ enqueue. Phase 3 capacity reservations cover uploads and complete publication sets and heartbeat for the full operation.
- Active revisions have explicit stale recovery: an admin may versionedly rebase after reviewing current versus proposed data, or supersede the edit while preserving history and cleaning staged media. Retained-photo FKs restrict raw deletion.
- Backup restore stages both database and media, validates cross-references before maintenance-mode paired cutover, and retains rollback copies; validation never modifies live resources.
- Product submission uses Google reCAPTCHA Enterprise Mobile SDK tokens executed for action `submit_product`, then a server-created Enterprise assessment verifies token validity, exact action, app/site key, score ≥0.5, and risk reasons; provider failure is retryable and client-only success is never trusted. Confirm exact SDK pins at implementation time (current documentation examples: Android 18.8.0, iOS 18.9.0+) against RN 0.76 hosts.
- Creation rollout is server-enforced through setting key `product_creation` with value `{ mode: 'off' | 'internal' | 'all' }`; `internal` means existing admin users plus an environment-managed user-ID allowlist. Expand migration A inserts `{ mode:'off' }` idempotently before any reader starts. Mode gates actor-specific `not_found.canCreate` plus private new-product draft metadata/photo/submit mutations; existing drafts stay readable, admins may still moderate the backlog, and ordinary active-product revisions remain available. Legacy `POST /v1/products` is always blocked with typed `upgrade_required` after this deployment so it cannot publish active products outside moderation.
- Idempotency is scoped to authenticated actor + method + canonical route + request fingerprint and atomically reserves in-flight keys; the existing path-only plugin must be hardened before private responses use it.
- Mobile and admin must use Expyrico theme tokens; Alert Red stays destructive-only.
- Shared contract changes require rebuilding `packages/shared` and refreshing both mobile vendored/resolved copies before mobile tests.
- No `.env`, credentials, media files, absolute local paths, or raw uploads enter git/logs.

## Phase Roadmap

| Phase | Name | Status | Depends on | Primary gate |
|---|---|---|---|---|
| 1 | [Contracts and data model](./phase-01-contracts-and-data-model.md) | Pending | — | shared build + migration tests |
| 2 | [Lookup and private draft lifecycle](./phase-02-lookup-and-private-draft-lifecycle.md) | Pending | 1 | product integration tests |
| 3 | [Product media pipeline and private delivery](./phase-03-product-media-pipeline-and-vps-delivery.md) | Pending | 1, 2 | hostile upload + prepared-intent + capacity tests |
| 4 | [Moderation and active-product revisions](./phase-04-moderation-and-active-product-revisions.md) | Pending | 1–3 | moderation/revision integration tests |
| 5 | [Mobile scan and draft editor](./phase-05-mobile-scan-and-draft-editor.md) | Pending | 1–4, 7 | Jest + Android native build |
| 6 | [Admin moderation console](./phase-06-admin-moderation-console.md) | Pending | 4 | admin Playwright + build |
| 7 | [Operations, abuse controls, and cleanup](./phase-07-operations-abuse-controls-and-cleanup.md) | Pending | 2–4 | config/infra/backup/sweeper tests |
| 8 | [End-to-end rollout and verification](./phase-08-end-to-end-rollout-and-verification.md) | Pending | 5–7 | full suites + device + restore drill |

## Dependency Graph

```text
Phase 1 ─▶ Phase 2 ─▶ Phase 3 ─▶ Phase 4 ─┬─▶ Phase 7 ─▶ Phase 5 ─┐
                                           └────────────▶ Phase 6 ─┼─▶ Phase 8
```

Phase 7 selects and implements the server abuse contract before Phase 5 consumes it. Phase 6 may proceed after Phase 4 while Phases 7 and then 5 continue on the other branch. File ownership is exclusive: mobile only in Phase 5; moderation UI and same-origin media proxy only in Phase 6; operational setting UI, API operations, infra, config, and workers only in Phase 7. Phase 8 makes no feature changes unless verification exposes a scoped defect.

## Cross-Plan Dependencies

- `plans/260714-0728-mobile-bare-rn-migration`: no blocking edge. Bare React Native, React Navigation, and Android host work are already present on `main`; its unresolved iOS compile limitation remains an external iOS verification constraint, not a prerequisite for Android/API delivery.
- `plans/260712-0821-password-reset-otp`: no overlap beyond shared auth/session infrastructure; no dependency edge.

## Test Strategy

Use RED → GREEN → REFACTOR per phase. API integration tests run against real PostgreSQL/Redis and isolated temporary media roots. Every test that writes files must assert exact cleanup and refuse any path outside its temp root. Mobile native-library selection is accepted only after Android debug compile and an iOS pod-install/compile attempt; mocks alone are insufficient. Run the narrowest tests first, then workspace typecheck/tests, then the full monorepo gate in Phase 8.

## Rollout Strategy

1. Expand product-status enums without changing row values and deploy Phase 1 compatibility readers while report writers still emit legacy `pending`; drain every pre-compatibility API instance. Then deploy Phase 2, which switches report writers to `report_hidden` and makes legacy lookup active-only. After that fleet is healthy, classify legacy `pending` rows with migration B while creation remains off.
2. Deploy the remaining draft/media/API/admin support with `product_creation.mode=off`; do not create creator `pending` rows until every compatibility-only API instance is drained.
3. Provision media root, private delivery, CDN nginx location, backups, quotas, and monitoring.
4. Deploy mobile editor to internal Android device(s); retain custom unlinked pantry item fallback.
5. Enable for internal users, exercise moderation/restore, then enable generally.
6. Keep `imageUrl` compatibility until all clients consume `photos[]`; remove it only in a separately approved cleanup.

## Whole-Plan Acceptance Criteria

- [ ] Barcodes distinguish local/external hit, conclusive full miss, and unavailable sources; QR local miss is conclusive.
- [ ] Scanner never routes arbitrary errors/outages into product creation.
- [ ] Authenticated creator can create/resume one private draft per identifier and cannot mutate the identifier.
- [ ] Other users cannot enumerate private metadata/media or attach the private product; they receive under-review/custom-item behavior. Report-hidden catalog products remain a distinct moderation state.
- [ ] Drafts cannot bypass submission abuse verification through REST, record PATCH, duplication, or offline sync; only submitted creator-private personal use is permitted.
- [ ] Creator can manage zero to five ordered processed photos with independent progress/retry/remove/reorder/cover.
- [ ] Upload validation, path containment, quotas, state/version guards, and cleanup survive malformed files and concurrency races.
- [ ] Submission is idempotent, becomes `pending`, and immediately continues into `AddRecordForm`.
- [ ] Admin can approve, request changes with reason, correct, reorder/remove, merge, recover stale revisions by explicit rebase/supersede, and resolve active-product revisions with atomic audit logs.
- [ ] Mobile creator can create/edit/stage/submit active-product revisions even when new-product creation is off; request-changes revisions remain resumable and active products stay unchanged until approval.
- [ ] Prepared media intents recover process death between byte creation and reference commit; durable cleanup and capacity reservations survive process/concurrency faults; account-scoped private-image caches and parent-bound delivery prevent leakage.
- [ ] Nginx exposes only approved public media; backup captures PostgreSQL plus referenced private/public media, and restore validates staging DB+media before paired cutover/rollback while quarantine/temp is excluded.
- [ ] Abuse assessment is verified server-side and upload/draft quotas protect VPS capacity.
- [ ] Focused and full shared/API/mobile/admin checks pass; Android physical-device flow passes; iOS result is reported truthfully against the known external limitation.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Lookup outage creates duplicate products | typed unavailable outcome; creation CTA only on conclusive miss |
| Filesystem/DB partial failure | quarantine, atomic rename, compensating unlink, durable cleanup jobs, isolated tests |
| Private media leaks via CDN | separate public/private paths; nginx aliases approved path only; API authorization for private media |
| Disk exhaustion/abuse | byte/count quotas, reserve threshold, monitoring, sweeper, five-photo cap |
| Reorder/delete races | product/edit `version` and transactional contiguous-order rewrite |
| External lookup overwrites user product | persistence service refuses `source=user` and all private states |
| Native picker breaks bare RN hosts | proof build before editor integration; record exact accepted version |
| Shared package drift | build and refresh both vendored/resolved copies, then import assertion |
| Moderation backlog | admin queue ships before mobile enablement; creation mode defaults to `off` |

## Unresolved Questions

None. Implementation must stop only if the documented native reCAPTCHA/Enterprise integration cannot provide server-verified score/action semantics or if `react-native-image-crop-picker` fails the required native proof build; in either case present verified alternatives rather than silently weakening the contract.
