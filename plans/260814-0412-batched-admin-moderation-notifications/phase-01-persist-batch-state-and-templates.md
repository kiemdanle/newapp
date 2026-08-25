---
phase: 1
title: Persist batch state and templates
status: completed
priority: P1
dependencies: []
---

# Phase 1: Persist Batch State and Templates

<!-- Updated: Validation Session 1 — versioned occurrence identity, stale-rebase capture, terminal delivery metadata, and keyed safe-template validation. -->

## Overview

Create the durable, transactionally populated moderation-event ledger and data model needed to aggregate submissions safely. Seed and validate the single editable moderation-summary template without changing existing expiry or giveaway notification behavior.

## Requirements

- Functional:
  - Record an event for each successful transition to `pending` in `submitDraft`, `submitProductEdit`, and stale `recoverProductEdit(... rebase)`.
  - Distinguish `new_product` from `product_revision`; retain source ID, post-transition submission version, submission timestamp, and server-created event timestamp.
  - Store a batch record, recipient snapshot, and separate `push`/`email` delivery records so aggregation, retries, and the admin audit view do not infer state from transient queue jobs.
  - Seed `notification_templates.key = moderation_queue` idempotently, initially enabled, with title/body strings using `{newProducts}`, `{revisions}`, and `{total}`.
  - Reject template updates containing unsupported placeholders and preserve normal template updates for existing keys.
- Non-functional:
  - All schema changes must be additive and use explicit indexes/constraints.
  - Event insertion must share the same Prisma transaction as the authoritative conditional status update.
  - No submission should be blocked by notification delivery or a BullMQ call.

## Architecture

Add four focused persistence concepts:

```text
ModerationNotificationEvent
  id, kind(new_product|product_revision), sourceId, submissionVersion,
  submittedAt, batchId NULL, createdAt,
  UNIQUE(kind, sourceId, submissionVersion)

ModerationNotificationBatch
  id, windowStart, windowEnd, newProductCount, revisionCount,
  recipientCount, createdAt

ModerationNotificationDelivery
  id, batchId, recipientUserId, channel(push|email),
  status(pending|processing|sent|skipped|failed), attempts,
  availableAt, leaseOwner NULL, leaseExpiresAt NULL,
  completedAt NULL, providerMessageId, errorMessage,
  UNIQUE(batchId, recipientUserId, channel)

ModerationNotificationPushAttempt
  id, deliveryId, pushTokenId, attemptNumber,
  status(sent|failed|invalid), providerMessageId, errorMessage,
  createdAt, UNIQUE(deliveryId, pushTokenId, attemptNumber)
```

Use a direct `batchId` relation on events. An event describes a successful *submission occurrence*, not the source entity: capture the post-transition `submissionVersion` in the same transaction and enforce `UNIQUE(kind, sourceId, submissionVersion)`. Batch workers claim only `batchId IS NULL` events with a deterministic cutoff, set their batch ID inside the same transaction that creates the batch, and compute the counts from those claimed events. This allows `changes_required -> pending` resubmissions and stale-edit rebases to generate a second alert without double-recording one guarded transition.

Do **not** put destination email addresses or FCM token values in event/batch rows. Snapshot recipient user IDs only. Phase 2 resolves current DB role/status and live channel endpoints at send time; token IDs may appear only in the linked per-token attempt rows. A batch with no active-admin recipients is committed with `recipientCount = 0`, all events assigned, and a health signal—never held for a future admin.

For atomic status writes:

```ts
await prisma.$transaction(async (tx) => {
  const changed = await tx.product.updateMany(/* existing state/version guard */);
  if (changed.count !== 1) throw conflict();
  await tx.moderationNotificationEvent.create({
    data: {
      kind: 'new_product',
      sourceId: productId,
      submissionVersion: input.version + 1,
      submittedAt: now,
    },
  });
});
```

Apply the same invariant after the conditional `ProductEdit` update. Existing retry/idempotency and optimistic-concurrency guards remain authoritative; event creation happens only after the guarded update succeeds.

## Related Code Files

- Modify: `api/prisma/schema.prisma` — add event/batch/delivery models, enums, relations, indexes.
- Create: `api/prisma/migrations/<timestamp>_add_moderation_notification_batches/migration.sql` — additive tables, FK/unique/index definitions, template upsert.
- Modify: `api/src/services/products/product-drafts.ts` — move the successful transition/event insert into one transaction.
- Modify: `api/src/services/products/product-edits.ts` — write versioned revision events transactionally after submit and after every stale rebase that returns an edit to `pending`.
- Modify: `api/prisma/seed-admin.ts` — add idempotent bounded plain-text `moderation_queue` template seed.
- Modify: `api/src/routes/admin/settings/notification-templates.ts` — load the target row before applying keyed moderation-template validation; preserve generic existing-template behavior.
- Create: `api/src/services/notifications/moderation-template.ts` — moderation-only plain-text, placeholder, URL/markup rejection, and safe renderer helpers.
- Modify: `packages/shared/src/schemas/admin/settings.ts` only for generic field bounds; do not apply moderation placeholder rules without the target template key.
- Modify: `api/tests/helpers/setup.ts` — include new tables in truncation and add required explicit test-DB DDL if this repository's test database migration workflow requires it.
- Modify/Create: `api/tests/integration/products-draft-lifecycle.test.ts`, `api/tests/integration/product-edits.test.ts`, `api/tests/integration/admin-notification-templates.test.ts` — prove occurrence identity, rebase events, transactional rollback, and keyed template invariants.

## Implementation Steps

1. Inspect the current migration sequence and test-schema bootstrap before choosing the migration timestamp. Add Prisma models/enums with explicit PostgreSQL mappings and indexes for unbatched event claims (`batch_id IS NULL`, submitted/version order), batch history, due recipient-channel work (`status`, `available_at`), terminal-history cleanup, and per-token attempts.
2. Use the post-transition version as `submissionVersion`: make the event key `(kind, sourceId, submissionVersion)` unique. Add FKs and retention-safe cascade/order semantics deliberately: delivery attempts reference their parent delivery; cleanup deletes attempts, deliveries, events, then batches only after all deliveries are terminal.
3. Write a hand-reviewed additive SQL migration. It must create tables/FKs/indexes, safely upsert the default `moderation_queue` template without overwriting operator edits, and avoid destructive enum/table operations.
4. Update the test DB DDL/bootstrap in the same commit when required by the existing `tests/helpers/setup.ts` convention; do not assume `prisma migrate` runs against `pantry_test`.
5. Refactor `submitDraft` only enough to make its existing successful conditional `Product` update and new versioned event create one transaction. Preserve ordering: validation, reCAPTCHA assessment, conditional transition, event insertion, read/serialize. A stale version, rejected assessment, failed transition, or idempotent replay must produce no new event.
6. Apply equivalent event writes to `submitProductEdit` and `recoverProductEdit(... rebase)`. Preserve role/owner/status/version guards. A user `changes_required -> pending` resubmission and a stale rebase producing `pending` each create a new occurrence using the incremented version; other admin moderation actions do not.
7. Seed `moderation_queue` with count-only copy, e.g. title `Moderation queue needs review`; body `{total} new moderation item(s): {newProducts} product(s), {revisions} revision(s).` Keep copy parameterized rather than embedding pluralization into an editable template.
8. Keep the generic shared patch schema compatible with existing templates. In the route, load the template first, then apply a moderation-only validator only for `key === 'moderation_queue'`: bounded plain text, exact allowlisted placeholders, no markup or URL syntax. The renderer must HTML-escape substituted/text values and build the only anchor from the canonical queue URL.
9. Add integration coverage against real Postgres for atomic event persistence, both submission types, stale rebase, failed/stale/repeated submissions, template seeding idempotency, generic existing-template edit compatibility, and moderation markup/URL/invalid-placeholder rejection.

## Success Criteria

- [ ] Migration is additive and test DB setup matches production schema. Normal rollback is application-only; schema reversal follows the exceptional audited Prisma-ledger/backup procedure in Phase 4.
- [ ] Exactly one event is committed with every successful versioned transition to `pending`, including user resubmissions and stale revision rebases.
- [ ] A second successful submission on the same product/edit has a different `submissionVersion` and creates a second event without colliding with its historical event.
- [ ] No event exists after failed reCAPTCHA, invalid state, stale version, duplicate/replayed submit, or a rebase that does not yield `pending`.
- [ ] Product/edit event and status mutation share one transaction; a forced event insert failure rolls back the status transition.
- [ ] `moderation_queue` seed does not overwrite an admin-customized template on later deploys/seeds.
- [ ] Existing expiry-template editing remains compatible; moderation-template editing rejects unknown placeholders, markup, URLs, and oversized text.
- [ ] Every terminal delivery can record `completedAt`, per-token attempts are linked/retained correctly, and focused draft lifecycle, product edit, template, migration, and typecheck tests pass.

## Risk Assessment

- **Occurrence identity:** source IDs repeat across submissions. Use the guarded post-transition version in the uniqueness key; never suppress valid resubmission/rebase events.
- **Transaction regression:** keep external reCAPTCHA outside the transaction; hold a DB transaction only around conditional update + event insert.
- **Legacy rows:** no backfill. Existing pending items do not generate retrospective alerts; only events created after rollout are eligible.
- **Template mismatch/injection:** avoid a general templating engine. Keep old generic-template semantics; moderation-only templates are plain text with a keyed allowlist and an HTML-escaping renderer.
