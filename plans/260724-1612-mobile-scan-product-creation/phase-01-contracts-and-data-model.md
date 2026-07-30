---
phase: 1
title: "Contracts and data model"
status: pending
priority: P1
effort: L
dependencies: []
---

# Phase 1: Contracts and Data Model

## Context Links

- [Plan overview](./plan.md)
- [Approved design](../../docs/superpowers/specs/2026-07-24-mobile-scan-product-creation-design.md)
- Existing contracts: `packages/shared/src/schemas/product.ts`, `packages/shared/src/schemas/admin/products.ts`, `packages/shared/src/schemas/error.ts`
- Existing model: `api/prisma/schema.prisma`

## Overview

Define executable shared contracts for lookup, errors, private product lifecycle, complete photo metadata, and versioned active-product revisions. Prepare an expand migration and a separately gated classification migration so compatible readers/writers deploy before legacy row meanings change.

## Requirements

- Product states: `draft | pending | changes_required | active | report_hidden | merged_into`. `pending` is reserved for creator-submitted private products. `report_hidden` is the distinct admin/report-moderation state for catalog products auto-hidden by reports.
- The current database's `pending` products predate creator submissions and therefore mean report-hidden catalog rows. Use an expand/classify rollout without renaming or dropping enum values: migration A adds `report_hidden` plus the new schema while leaving every row unchanged; Phase 1 deploys compatibility readers that understand both meanings while report writers continue emitting legacy `pending`; every pre-compatibility API instance drains; Phase 2 then switches report writers to `report_hidden` and makes legacy lookup active-only; only afterward does migration B classify pre-feature `pending` rows as `report_hidden`. New-product submission remains disabled until migration B verifies no report writer still creates `pending`, after which the existing `pending` enum value is reserved semantically for creator submissions.
- Revision states: preserve `rejected` as a terminal historical state; use `draft | pending | changes_required | approved` for ordinary new revision moderation. Admin action is named `request_changes`; resulting state is `changes_required`. The only new write to `rejected` is an explicit stale-revision `supersede`, distinguished by its machine-safe superseded reason and audit event; rejected/superseded edits are read-only.
- Lookup v2 outcomes: `found | editable_private | creator_pending | under_review | not_found | temporarily_unavailable`. `editable_private` is limited to the creator's `draft|changes_required` product. `creator_pending` returns only the creator's own submitted product for read-only awaiting-review/personal-pantry continuation. `under_review` covers an identifier reserved by another user's private product or a report-hidden catalog product and contains no product ID, creator, status, or metadata.
- Errors define structured version conflicts (with an optional caller-visible canonical product) and typed media/capacity failures.
- Shared admin settings define `productCreationSettingsSchema` as `{ mode: 'off' | 'internal' | 'all' }`; the migration inserts setting key `product_creation` with `{ "mode": "off" }` using `ON CONFLICT DO NOTHING` before any gating route reads it.
- Description normalizer preserves Unicode/literal markup as text, converts blank to `null`, permits tab/newline, and rejects other C0/C1 controls.
- `ProductPhoto` stores private/public keys and complete display/thumbnail metadata, uploader, moderation state/note, order, and timestamps.
- `ProductEdit` stores `version`, `baseProductVersion`, lifecycle, feedback/timestamps, and exactly one open edit per creator/product.
- Revision photo entries represent the entire desired ordered set: each entry references either a retained live photo or newly staged media, never both.
- `imageUrl` remains a temporary active-cover projection.

## Produced Interfaces

```ts
type ProductLookupV2Response =
  | { outcome: 'found'; product: Product }
  | { outcome: 'editable_private'; product: Product }
  | { outcome: 'creator_pending'; product: Product }
  | { outcome: 'under_review' }
  | { outcome: 'not_found'; canCreate: boolean }
  | { outcome: 'temporarily_unavailable'; retryAfterSeconds?: number };

type ProductDraftsQuery = {
  cursor?: string;
  limit: number; // default 20, range 1–50
  status?: 'draft' | 'pending' | 'changes_required';
};

type ProductDraftRow = {
  id: string;
  name: string;
  identifier: { kind: 'barcode' | 'qr'; value: string };
  status: 'draft' | 'pending' | 'changes_required';
  version: number;
  moderationFeedback: string | null;
  cover: { photoId: string; thumbnailUrl: string } | null;
  updatedAt: string;
};

type ProductDraftsPage = {
  items: ProductDraftRow[];
  nextCursor: string | null;
};

type VersionConflictProblem = Problem & {
  code: 'version_conflict';
  currentVersion: number;
  canonicalProduct?: Product; // only when visible to caller
};
```

The strict shared query schema coerces/validates `limit` to default 20 with range 1–50, validates opaque `cursor`, and accepts only creator-private statuses. The row/page schema exposes one discriminated immutable identifier, caller-visible feedback, an authorized cover thumbnail route (never a storage key), ISO `updatedAt`, and nullable `nextCursor`.

Draft create requires `{ barcode XOR qrPayload }`; the server repeats the conclusive lookup before reserving the identifier. Patch supports `name`, `description`, `brand`, and `category`; reorder supports the exact unique ordered IDs; submit includes `{ version, abuseToken }`. Every retryable create/submit also requires `Idempotency-Key`.

## Data Model

`Product` gains description, version, moderation fields, and photos. `ProductPhoto` contains:

- `id`, `productId`, `position`, `uploadedByUserId`, `moderationStatus`, `moderationNote`;
- nullable `privateStorageKey` before publication and nullable `publicStorageKey` after publication;
- normalized MIME (`image/webp`);
- display and thumbnail byte size, width, and height independently;
- `createdAt`, `updatedAt`;
- unique `(productId, position)` and check position 0–4.

`ProductEdit` gains `version`, `baseProductVersion`, `status`, `moderationNotes`, `submittedAt`, `resolvedBy`, `resolvedAt`, and `updatedAt`. Expand migration A appends `draft` and `changes_required` to the existing mapped PostgreSQL `product_edit_status` enum while retaining existing `pending|approved|rejected` values and rows; Prisma and shared schemas must use that same mapped enum. Add a partial unique index for one open edit per `(productId, submittedBy)` where status is `draft|pending|changes_required`.

`ProductEditPhoto` contains `position`, optional `sourceProductPhotoId`, optional staged private storage/variant metadata, uploader/timestamps, and a database XOR check: retained source or staged media. Unique `(productEditId, position)`. Retained source uses `onDelete: Restrict`; a direct admin photo deletion must first rebase or supersede every open edit that references it, so deletion never silently invalidates a desired set.

`MediaOperationOutbox` is the durable DB/filesystem handoff. It stores `id`, operation kind (`promote_private | publish_public | delete_private | delete_public | delete_staged | enqueue_cleanup`), target storage keys as a validated JSON payload, lifecycle (`prepared | pending | processing | completed | failed`), producer/worker lease owner and expiry, attempts, `availableAt`, last error summary, and timestamps. Before any final private rename or public copy, the producer commits a `prepared` intent with a renewable lease and deterministic target keys. The later reference-changing transaction atomically marks that intent `completed` and inserts any follow-up cleanup work. Workers claim expired prepared or pending cleanup work with `FOR UPDATE SKIP LOCKED`, retry idempotently, and recheck every key immediately before deleting an unreferenced artifact.

## Related Code Files

- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/schemas/admin/products.ts`
- Modify: `packages/shared/src/schemas/admin/settings.ts`
- Modify: `packages/shared/src/schemas/error.ts`
- Modify: `packages/shared/src/index.ts` when exports are explicit
- Create: `packages/shared/src/schemas/product.test.ts`
- Create: `packages/shared/src/schemas/admin/products.test.ts`
- Create: `packages/shared/src/schemas/admin/settings.test.ts`
- Create: `packages/shared/src/schemas/error.test.ts`
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<timestamp>_expand_product_drafts_photos_and_moderation/migration.sql`
- Create: `api/prisma/migrations/<timestamp>_classify_report_hidden_products/migration.sql`
- Modify: `api/src/errors.ts`
- Modify: `api/src/services/products/serializer.ts`
- Test: `api/tests/integration/products-schema.test.ts`
- Generated: `packages/shared/dist/**`
- Generated: `apps/mobile/local-packages/@expyrico/shared/dist/**`
- Refresh: pnpm workspace resolution/lockfile through `pnpm install`

## Implementation Steps

### Task 1: Add a real shared-schema test gate

- [ ] Add Vitest to `packages/shared` dev dependencies and change `test` from `echo skip` to `vitest run`; add a minimal config only if default discovery cannot find colocated tests.
- [ ] Write failing tests for all lookup branches, non-disclosing `under_review`, strict `productDraftsQuerySchema` defaults/status/cursor/limit bounds, strict draft row/page projection (identifier XOR, caller feedback, authorized cover summary, ISO time, nullable `nextCursor`, no storage keys), description normalization/control characters, fields/limits, five unique ordered photos, revision actions/statuses, `product_creation` setting values/default shape, and typed error parsing.

```ts
expect(productLookupV2ResponseSchema.parse({ outcome: 'under_review' }))
  .toEqual({ outcome: 'under_review' });
expect(() => productLookupV2ResponseSchema.parse({
  outcome: 'under_review', productId: crypto.randomUUID(),
})).toThrow();
```

- [ ] Run `pnpm --dir packages/shared test`.
  Expected: FAIL because schemas are absent.
- [ ] Implement the minimum Zod schemas/types. Use strict objects for privacy-sensitive outcomes and mutation inputs.
- [ ] Run `pnpm --dir packages/shared test && pnpm --dir packages/shared typecheck`.
  Expected: PASS.

### Task 2: Make structured conflicts representable end to end

- [ ] Add failing tests for `version_conflict` with and without its optional caller-visible `canonicalProduct`, plus `unsupported_media`, `payload_too_large`, `pixel_limit_exceeded`, `processing_timeout`, and `storage_capacity_unavailable`.
- [ ] Extend `Problem` and `AppError` with safe structured fields (`currentVersion`, optional caller-visible `canonicalProduct`) rather than a generic arbitrary details bag.
- [ ] Update `toProblem` tests to prove hidden canonical products are never serialized.
- [ ] Run shared tests and `pnpm --dir api test -- tests/unit/errors.test.ts` (create/extend the exact existing error test file).
  Expected: PASS.

### Task 3: Add the expand/classify database model

- [ ] Write `api/tests/integration/products-schema.test.ts` to prove columns, mapped PostgreSQL enum values, XOR/check constraints, unique positions, retained-photo restrictive FK, prepared/claimed `MediaOperationOutbox` fields/indexes, and partial one-open-edit index. Include concurrent insert races and an upgrade fixture with existing `pending|approved|rejected` product edits whose IDs/status/history remain unchanged. Seed two legacy report-auto-hidden `Product.status='pending'` rows—one with no creator and one retaining a creator ID—and verify migration A leaves both readable while migration B classifies both as `report_hidden`.
- [ ] Run `pnpm --dir api test -- tests/integration/products-schema.test.ts`.
  Expected: FAIL before migrations.
- [ ] Update Prisma models and generate two ordered migrations:

```bash
pnpm --dir api db:migrate --name expand-product-drafts-photos-and-moderation
# After the compatibility API/report writer has deployed and old instances are drained:
pnpm --dir api db:migrate --name classify-report-hidden-products
pnpm --dir api exec prisma validate
pnpm --dir api db:generate
```

- [ ] Review migration A SQL. Add `report_hidden`, `draft`, and `changes_required` to the existing product enum without renaming/removing `pending`; append `draft` and `changes_required` to mapped `product_edit_status` without replacing `pending|approved|rejected`; preserve every row. Insert `settings(key,value) = ('product_creation','{"mode":"off"}'::jsonb)` with `ON CONFLICT (key) DO NOTHING`, using actual mapped timestamp columns. If the deployed PostgreSQL version cannot use a newly added enum value in the same transaction, keep enum addition and all consumers/data updates in later migrations.
- [ ] Prepare and test the Phase 1 compatibility reader required after migration A: both old report-hidden `pending` rows and future `report_hidden` rows parse safely and are treated as hidden by every Phase 1-touched serializer/consumer, while existing report auto-hide/resolution writers intentionally continue writing legacy `pending`. Phase 2 owns the later writer switch plus active-only legacy lookup before Phase 8 performs production classification. New creator submission stays disabled throughout this window.
- [ ] Review migration B SQL and test it as a separately deployable artifact. Its documented preconditions are: migration A and Phase 1 compatibility readers fully deployed, every pre-compatibility API instance drained, Phase 2 active-only legacy lookup/report writers fully deployed, report writers using `report_hidden`, and creation mode off. Because creator submission has remained disabled from before migration A through classification, and Phase 2 writers have been verified to emit only `report_hidden`, every remaining `Product.status='pending'` row is pre-feature report-hidden provenance regardless of nullable/non-null creator ID. Migration B updates all remaining `pending` products to `report_hidden`; a preflight aborts if creation mode is not `off`, any submission timestamp/private draft lifecycle marker exists on such a row, or any deployed report writer still emits `pending`. It never renames an enum value. Tests include a creator-bearing legacy report-hidden row. Phase 8 executes it and verifies zero legacy report-hidden `pending` rows before creator submission may use `pending`.
- [ ] Add SQL check/partial indexes Prisma cannot express directly. Extend the schema integration test to prove clean and upgraded databases contain default-off `product_creation`, prepared-intent/outbox claim indexes, unchanged historical rows, and correct two-release classification.
- [ ] Rehearse the full sequence on clean and upgraded test databases with explicit deploy gates: migration A → Phase 1 compatibility readers with legacy writers → drain pre-compatibility instances → Phase 2 active-only legacy lookup and `report_hidden` writer → migration B. Phase 1's schema/fixture test validates both migration artifacts; Phase 8 owns the production-order execution.
  Expected: PASS.

### Task 4: Keep immediate serializers/consumers compiling

- [ ] Add failing serializer tests for description/version/ordered photos and redaction of storage keys/moderation internals.
- [ ] Update `api/src/services/products/serializer.ts` and its Prisma projections to return backward-compatible `imageUrl` plus `photos[]`; private/public URL derivation remains delegated to Phase 3 and may initially return authorized route URLs.
- [ ] Run `pnpm --dir api test -- serializer && pnpm --dir api typecheck`.
  Expected: PASS before later routes change.

### Task 5: Build and synchronize runtime artifacts

- [ ] Run `pnpm --dir packages/shared build`.
- [ ] Replace `apps/mobile/local-packages/@expyrico/shared/dist` with the generated `packages/shared/dist` through the existing repository sync procedure; do not hand-edit generated output.
- [ ] Run `pnpm install` to refresh workspace resolution, then a mobile Jest import assertion parsing `under_review`, `creator_pending`, `productDraftsQuerySchema`, `productDraftsPageSchema`, and `version_conflict` from the resolved package.
- [ ] Run `pnpm --dir packages/shared test && pnpm --dir api typecheck && pnpm --dir apps/mobile test -- shared-contract`.
  Expected: PASS.

### Task 6: Commit boundary

- [ ] Run `git diff --check`; inspect migration/generated files for secrets, media, and local paths.
- [ ] Commit only after all gates pass:

```bash
git add packages/shared api/prisma api/src/errors.ts api/src/services/products/serializer.ts api/tests apps/mobile/local-packages/@expyrico/shared pnpm-lock.yaml
git commit -m "feat(products): add draft and photo contracts"
```

## Success Criteria

- [ ] Shared tests are real, not an `echo skip` script.
- [ ] All outcome/error/status names are representable and consistent.
- [ ] Database enforces position, XOR, retained-photo safety, durable media outbox, and one-open-edit race invariants.
- [ ] Legacy report-hidden products are classified separately from creator submissions before visibility changes deploy.
- [ ] Photo/revision models cover every approved field and retained/staged desired order.
- [ ] Public DTOs never expose storage keys/uploader/moderation internals.
- [ ] Existing rows survive migration; shared/API/mobile contract gates pass.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Enum/model migration blocks deploy | Low | High | High | expand/classify split, compatibility-reader gate, old-instance drain, staging rehearsal | API/DB |
| Generated shared drift | Medium | High | High | mobile runtime import assertion after `pnpm install` | Mobile |
| Revision constraint rejects legacy data | Low | High | High | pre-migration query; keep legacy `rejected`; abort migration on conflicts | API/DB |
| Storage keys leak in DTO | Low | High | High | strict schemas and serializer redaction tests; block phase completion | Security/API |
