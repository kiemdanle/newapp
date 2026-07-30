---
phase: 3
title: "Product media pipeline and private delivery"
status: pending
priority: P1
effort: L
dependencies: [1, 2]
---

# Phase 3: Product Media Pipeline and Private Delivery

## Context Links

- [Plan overview](./plan.md)
- [Phase 1 media model](./phase-01-contracts-and-data-model.md)
- [Phase 2 visibility](./phase-02-lookup-and-private-draft-lifecycle.md)
- API bootstrap: `api/src/server.ts`, `api/src/config.ts`

## Overview

Implement bounded streaming decode into a physically private namespace, ordered photo mutations, authorized mobile media delivery, and crash-safe publication primitives. Phase 7 alone owns nginx/Ansible and exposes only the public namespace.

## Requirements

- One file and no extra multipart fields/parts; ≤10 MiB compressed.
- Limits: 40 MP, width/height ≤12,000 px each, channels 1–4, generated display ≤8 MiB, thumbnail ≤2 MiB, processing deadline 30 seconds, and configurable global Sharp concurrency default 2.
- Stream to quarantine; never buffer source upload. Reject truncation, parser limit, MIME spoof, corrupt decode, SVG/GIF/video/archive.
- JPEG/PNG; HEIC only when startup decode capability passes.
- Rotate by EXIF, convert sRGB, strip all metadata/GPS, WebP display ≤1600² and thumbnail ≤480² without enlargement.
- Separate keys:

```text
quarantine/<request-uuid>/source
private/products/<product-id>/<photo-id>/<variant-uuid>/{display,thumb}.webp
private/product-edits/<edit-id>/<photo-id>/<variant-uuid>/{display,thumb}.webp
public/products/<product-id>/<publication-uuid>/{display,thumb}.webp
```

- Public paths are immutable and never overwritten. Approval creates a new publication UUID.
- Mobile private media uses API routes fetched with Authorization headers. No bearer token appears in URLs.
- DB/filesystem failures use compensation plus Phase 1 `MediaOperationOutbox`. Before every final private rename or public copy, commit a `prepared` intent containing deterministic target keys under a renewable producer lease. The reference transaction atomically completes the intent and inserts follow-up cleanup; expired prepared intents recover unreferenced artifacts. BullMQ is only a wake-up mechanism. No cross-resource atomicity claim.
- Private delivery has two explicit parent-bound routes: `/products/:productId/photos/:photoId/:variant` for `ProductPhoto` and `/product-edits/:editId/photos/:photoId/:variant` for `ProductEditPhoto`. Both validate the parent/child relation; cross-product/edit ID substitution is rejected non-enumeratively.
- **`UNIQUE(product_id, position)` on `ProductPhoto` and `UNIQUE(product_edit_id, position)` on `ProductEditPhoto` are `DEFERRABLE INITIALLY IMMEDIATE`** (Phase 1 migration `20260730044500_make_photo_position_deferrable`) so a reorder transaction can `SET CONSTRAINTS ... DEFERRED` and write a whole target order without an illegal intermediate collision. This has a load-bearing consequence: **PostgreSQL refuses a deferrable constraint as an `ON CONFLICT` arbiter, and Prisma's `.upsert(...)` on either table fails the same way.** Verified by reviewer-p1 against a scratch DB: `INSERT ... ON CONFLICT (product_id, position) DO NOTHING` raises SQLSTATE `55000` ("ON CONFLICT does not support deferrable unique constraints/exclusion constraints as arbiters"), and `prisma.productPhoto.upsert({ where: { productId_position: ... } })` fails with the same `55000` wrapped in a raw `ConnectorError` whose `err.code` is `undefined` — it will **not** match the `err.code === 'P2002'` handling pattern used elsewhere in this codebase, and will surface as an unhandled 500 if not special-cased. Phase 3 photo insert/replace/reorder services must use explicit find-then-create/update inside a transaction (with `SET CONSTRAINTS ... DEFERRED` for reorders) and must never call `upsert`/`ON CONFLICT` against `(product_id, position)` or `(product_edit_id, position)`. This is an accepted trade-off of the deferrable-constraint fix, not a defect to work around by reverting it.

## Produced Interfaces

```ts
withMediaMutationLease<T>(kind, operation): Promise<T>;
prepareMediaOperation(input): Promise<PreparedMediaIntent>;
processProductUpload(input): Promise<ProcessedVariants>;
publishProductPhoto(photoId, publicationId, intentId): Promise<PublicVariants>;
reserveMediaCapacity(input): Promise<MediaCapacityReservation>;
removeProductPhoto(actor, input): Promise<Product>;
reorderProductPhotos(actor, input): Promise<Product>;
```

`withMediaMutationLease` is the single Phase 7-compatible fence entry point for every operation that can change a referenced private/public key or file. Phase 3 supplies its normal DB/Redis lease implementation, prepared-intent recovery, and the atomic heartbeating capacity-reservation service for upload and whole-publication bytes; Phase 4 consumes those production services rather than a stub. Phase 7 extends the same coordinator with backup freeze, operational reconciliation, monitoring, and cleanup semantics. `publishProductPhoto` requires a committed prepared intent and copies/hard-links or renames private variants to its fresh deterministic public sibling. Phase 4 writes the returned public key and completes the intent in the same moderation transaction; an expired intent recovers an unreferenced publication after a last-moment reference check. Old/private paths are cleaned only post-commit.

## Related Code Files

- Modify: `api/package.json`, `pnpm-lock.yaml`
- Modify: `api/src/config.ts`
- Modify: `api/src/server.ts`
- Create: `api/src/services/products/product-media-coordinator.ts`
- Create: `api/src/services/products/product-media-storage.ts`
- Create: `api/src/services/products/product-image-processor.ts`
- Create: `api/src/services/products/product-photos.ts`
- Create: `api/src/services/products/product-media-outbox.ts`
- Create: `api/src/services/products/product-media-capacity.ts`
- Create: `api/src/routes/products/photo-upload.ts`
- Create: `api/src/routes/products/photo-delete.ts`
- Create: `api/src/routes/products/photo-order.ts`
- Create: `api/src/routes/products/private-media.ts`
- Create: `api/src/routes/products/edit-private-media.ts`
- Modify: product route registration file
- Test: `api/src/services/products/product-image-processor.test.ts`
- Test: `api/src/services/products/product-media-storage.test.ts`
- Test: `api/tests/integration/products-photos.test.ts`
- Test: `api/tests/integration/products-private-media.test.ts`
- Test: `api/tests/integration/product-media-outbox.test.ts`
- Test: `api/tests/integration/product-media-capacity.test.ts`
- Test: `api/tests/integration/product-media-publication.test.ts`
- Do not modify: `infra/**` (Phase 7 ownership)

## Implementation Steps

### Task 1: Pin compatible multipart/Sharp and validate config

- [ ] Resolve current Fastify-4-compatible `@fastify/multipart` and Sharp documentation through Context7; pin exact compatible versions without changing Fastify.
- [ ] Add validated media root, byte/pixel/dimension/channel/output/deadline/concurrency/quality values. Numeric defaults above are explicit; production root/base URL remain required config.
- [ ] Register one-file multipart route limits without changing Fastify's global 1 MB JSON limit.
- [ ] Add startup HEIC capability probe and explicit supported-format response/config metric.
- [ ] Run `pnpm --dir api typecheck`.
  Expected: PASS.

### Task 2: TDD storage containment and hostile decode

- [ ] Generate small test fixtures at test runtime. Cover: valid JPEG/PNG, HEIC capability branch, extra field/part, second file, truncation, >10 MiB, MIME spoof, corrupt/polyglot, unsupported format, >40 MP, >12k width/height, >4 channels, traversal, timeout, output-byte overflow, and many concurrent decodes.
- [ ] Assert success: EXIF orientation, sRGB, no enlargement, exact WebP, dimensions, output limits, and no EXIF/GPS.
- [ ] Run `pnpm --dir api test -- src/services/products/product-media-storage.test.ts src/services/products/product-image-processor.test.ts`.
  Expected: FAIL before services.
- [ ] Implement path containment using resolved root plus separator-safe prefix. Accept UUID owners only; never concatenate client paths.
- [ ] Add `product-media-coordinator.ts` as the mandatory wrapper for every final referenced-file/key mutation. Implement the normal DB/Redis mutation lease and heartbeat in Phase 3; keep its freeze policy injectable so Phase 7 can add backup acquisition without changing callers.
- [ ] Implement `product-media-capacity.ts`: atomically reserve worst-case source/generated bytes for upload and the sum of every display/thumbnail byte for a complete publication set; heartbeat through the bounded operation; reconcile actual bytes or release on every terminal path. Concurrent reservations cannot exceed configured usable capacity minus reserve.
- [ ] Stream to quarantine with backpressure and abort cleanup. Decode through a semaphore of 2/default configurable slots and an abortable 30-second deadline.
- [ ] Before atomically renaming generated variants into `private/.../<variant-uuid>`, commit a prepared intent with deterministic keys and producer lease. The later product-photo transaction completes it; process death leaves an expired recoverable intent, not an untracked orphan. Clean partial temp siblings directly because they are not final/served keys.
- [ ] Run focused tests twice and assert empty temp roots after failures.
  Expected: PASS.

### Task 3: Transactional ordered photo mutations

- [ ] Write integration cases: owner/admin, other user, pending creator rejection, sixth photo, extra multipart part, stale version, concurrent quota race, delete cover, collision-safe reorder, invalid ID set, stream abort, DB fail after private promotion, and unlink fail after commit.
- [ ] Run `pnpm --dir api test -- tests/integration/products-photos.test.ts`.
  Expected: FAIL.
- [ ] Authorize before stream acceptance where possible; atomically reserve a slot/current product version, process file, insert complete metadata, increment product version, and compensate variants on commit failure.
- [ ] Reorder exact unique set in one transaction using collision-safe temporary positions; delete relation/reindex/version and insert the `MediaOperationOutbox` cleanup row in the same transaction. A post-commit BullMQ publish may wake the worker, but polling/claiming the outbox guarantees progress if the process dies before enqueue. Position writes must use explicit `SET CONSTRAINTS ... DEFERRED` + per-row create/update, never `ON CONFLICT`/Prisma `.upsert(...)` against `(product_id, position)` / `(product_edit_id, position)` — see the Requirements note above; the constraint's deferrability makes it an invalid `ON CONFLICT` arbiter (SQLSTATE `55000`, unclassifiable `err.code`).
- [ ] Add outbox tests for `SIGKILL` after each final private rename but before the photo-reference transaction, process death between reference commit and queue publish, duplicate delivery, producer/worker crash and lease expiry, retry/backoff, and last-moment reference recheck. Prepared-intent recovery deletes only an unreferenced key; a completed reference prevents deletion.
- [ ] Do not publish or update `imageUrl` for private products.
- [ ] Run focused test.
  Expected: PASS.

### Task 4: Authorized private media transport

- [ ] Write real HTTP byte-fetch tests for creator/admin/other user/anonymous, product and staged-edit photos, invalid variant/traversal, mismatched product/edit parent IDs, cross-kind photo-ID substitution, revoked auth, and cache headers.
- [ ] Implement `/products/:productId/photos/:photoId/:variant` with Phase 2 visibility and `/product-edits/:editId/photos/:photoId/:variant` with edit-owner/admin authorization. Each query binds the photo ID to its declared parent and kind before contained known-variant mapping. Respond with `Content-Type: image/webp`, `nosniff`, and `Cache-Control: private, no-store`.
- [ ] Mobile/admin clients request these URLs with Authorization through their authenticated adapters/proxy; ordinary URLs are not assumed to authenticate.
- [ ] Run `pnpm --dir api test -- tests/integration/products-private-media.test.ts`.
  Expected: PASS.

### Task 5: Crash-safe public publication and capacity primitives

- [ ] Write capacity tests for concurrent uploads, concurrent complete product/revision publication sets near the reserve, lease heartbeat, stale-owner reconciliation, actual-byte reconciliation, and every failure/timeout path. Assert aggregate reservations never exceed configured usable bytes and no final/public key is created without a live reservation.
- [ ] Write publication fault tests: prepared-intent commit failure; copy/link failure; `SIGKILL` after each public object creation and before reference commit for both new-product and revision sets; DB rollback; DB public-key/intent completion then wake-up failure; retry; never-overwrite same URL; preapproval public path absent.
- [ ] Run `pnpm --dir api test -- tests/integration/product-media-capacity.test.ts tests/integration/product-media-publication.test.ts`.
  Expected: FAIL.
- [ ] Implement atomic Redis capacity reservations and publication to fresh deterministic UUID public paths through `withMediaMutationLease`. Persist the prepared intent before the first copy and heartbeat intent, lease, and whole-set reservation through all copies plus the caller's reference transaction. Return metadata and intent ID to Phase 4; do not mark DB approved inside storage. Phase 4 atomically completes the intent with referenced keys. Compensation or stale-intent recovery removes only unreferenced new public objects after a last-moment DB check and reconciles capacity. Route upload promotion and delete cleanup scheduling through the same coordinator so Phase 7's freeze sees every class.
- [ ] Run capacity/publication tests twice, including recovery after simulated process restart.
  Expected: PASS.

### Task 6: Regression and commit boundary

- [ ] Run:

```bash
pnpm --dir api test -- src/services/products/product-media-storage.test.ts
pnpm --dir api test -- src/services/products/product-image-processor.test.ts
pnpm --dir api test -- tests/integration/products-photos.test.ts
pnpm --dir api test -- tests/integration/products-private-media.test.ts
pnpm --dir api test -- tests/integration/product-media-outbox.test.ts
pnpm --dir api test -- tests/integration/product-media-capacity.test.ts
pnpm --dir api test -- tests/integration/product-media-publication.test.ts
pnpm --dir api typecheck
```

- [ ] Commit only API/media work:

```bash
git add api/package.json api/src api/tests pnpm-lock.yaml
git commit -m "feat(products): add secure photo pipeline"
```

## Success Criteria

- [ ] Every hostile input/resource limit has a typed failure and zero residue.
- [ ] Processing concurrency and deadline bound CPU/memory pressure.
- [ ] Private/public trees are physically separate; public bytes use fresh immutable UUID paths.
- [ ] Ordered photo quota/version invariants survive concurrency.
- [ ] Private product and staged-edit byte fetches require parent-bound caller authorization and are no-store.
- [ ] Prepared-intent/outbox tests prove recovery across pre-reference and post-commit process-crash gaps.
- [ ] Atomic capacity tests prove uploads and complete publication sets cannot exhaust reserved disk under concurrency.
- [ ] Publication fault tests prove compensation/recovery; Phase 7 can safely alias only `public/`.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Decode resource exhaustion | Medium | Critical | Critical | all numeric bounds + semaphore/deadline; disable uploads on saturation | API/Ops |
| Private file exposed | Low | Critical | Critical | physical namespaces; no infra alias until Phase 7 tests | Security/Ops |
| DB/filesystem divergence | Medium | High | High | fault-tested compensation and durable cleanup | API |
| HEIC varies by host | Medium | Medium | Medium | startup probe; reject when unsupported | Ops/API |
| Immutable URL overwritten | Low | High | High | publication UUID and no overwrite API | API |
