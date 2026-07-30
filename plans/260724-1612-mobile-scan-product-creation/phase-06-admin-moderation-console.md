---
phase: 6
title: "Admin moderation console"
status: pending
priority: P1
effort: M
dependencies: [4]
---

# Phase 6: Admin Moderation Console

## Context Links

- [Plan overview](./plan.md)
- [Phase 4 API](./phase-04-moderation-and-active-product-revisions.md)
- Existing pages: `apps/admin/src/app/(admin)/products/`
- Server-only API client: `apps/admin/src/lib/admin-api.ts`
- Existing E2E: `apps/admin/tests/e2e/`, `apps/admin/playwright.config.ts`

## Overview

Extend the existing admin products console for new/revision moderation. Render private bytes through an authenticated same-origin streaming proxy instead of bearer URLs/Next optimizer, and test interactive UI through the existing Playwright harness rather than unsupported colocated Node Vitest TSX tests.

## Requirements

- Queue distinguishes new product/revision and supports type/status/age/pagination.
- Revision detail compares live/proposed metadata and complete desired photo order.
- Admin proxy validates admin session, accepts strict target kind + parent ID + photo ID + variant, fetches the matching Phase 3 product-photo or product-edit-photo route server-side, streams `image/webp`, and sets `private, no-store`; no bearer URL reaches HTML, optimizer, preload, logs, or public cache.
- Actions use exact API contracts:
  - `POST /v1/admin/products/:id/resolve` `{ decision:'approve'|'request_changes', reason?, version }`.
  - `POST /v1/admin/product-edits/:id/resolve` same decision/version.
  - existing patch/photo/merge routes extended with version.
- Request changes requires reason; conflicts require refresh/re-review, never auto-retry.
- Shared server-action parsing and API RBAC remain authoritative.

## Related Code Files

- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/app/api/admin-product-media/[targetKind]/[parentId]/[photoId]/[variant]/route.ts`
- Modify: `apps/admin/src/app/(admin)/products/pending/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/pending/pending-actions.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`
- Modify: existing merge page/components
- Create: `apps/admin/src/app/(admin)/products/pending/moderation-filters.tsx`
- Create: `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`
- Create: `apps/admin/src/app/(admin)/products/[id]/revision-comparison.tsx`
- Create: `apps/admin/tests/e2e/product-moderation.spec.ts`
- Modify: existing Playwright API mocks/fixtures/store files used by other admin E2E specs
- Test: `apps/admin/tests/unit/admin-api.test.ts`
- Test: `apps/admin/tests/unit/product-actions.test.ts` for pure action parsing only

## Implementation Steps

### Task 1: Typed client/actions and media proxy

- [ ] Add unit tests for queue/detail parsing, exact decision values, required reason, patch/photo/merge, 401/403, and structured version conflict.
- [ ] Add route tests or Playwright request tests for media proxy: product and staged-edit success bytes, nonadmin/anonymous denial, invalid target kind/parent/photo/variant, cross-product/edit ID substitution, upstream expiry/error, no-store/nosniff, and no redirect/bearer leakage.
- [ ] Run `pnpm --dir apps/admin test`.
  Expected: FAIL.
- [ ] Implement server client/action methods and same-origin route. It obtains the existing admin server session, calls API privately, streams bytes, and never uses Next Image optimization for pending media.
- [ ] Run unit/request tests.
  Expected: PASS.

### Task 2: Queue and detail E2E

- [ ] In `product-moderation.spec.ts`, seed/mock pending product and revision. Test filters, pagination, empty/error states, creator/age/photo count, ordered proxy thumbnails, and before/after revision comparison.
- [ ] Implement server-rendered queue from validated URL search params; avoid duplicate client fetching and N+1 requests.
- [ ] Run `pnpm --dir apps/admin test:e2e -- tests/e2e/product-moderation.spec.ts`.
  Expected: PASS after implementation.

### Task 3: Decisions, conflicts, correction, media, merge

- [ ] E2E test approve/request changes with confirmation/reason, duplicate-submit disable, success navigation, conflict refresh, correction, keyboard photo reorder, cover/remove, merge source-target confirmation, and audit history.
- [ ] Add stale-revision recovery E2E: after a direct correction/photo conflict, show current-vs-proposed diff and explicit **Rebase** and destructive **Supersede** actions. Rebase requires reviewed retained-photo mapping and returns the edit for moderation; supersede confirms staged cleanup/history preservation and lets the creator start again.
- [ ] Use theme tokens and accessible dialogs/focus return. Alert Red only for remove/merge/supersede.
- [ ] On ordinary 409 preserve current view and require refresh; never replay against changed content. Recovery occurs only through the explicit versioned API action.
- [ ] Run targeted Playwright spec.
  Expected: PASS.

### Task 4: Full admin gate and commit

- [ ] Run:

```bash
pnpm --dir apps/admin test
pnpm --dir apps/admin test:e2e -- tests/e2e/product-moderation.spec.ts
pnpm --dir apps/admin lint
pnpm --dir apps/admin typecheck
pnpm --dir apps/admin build
```

- [ ] Commit after PASS:

```bash
git add apps/admin
git commit -m "feat(admin): add product moderation console"
```

## Success Criteria

- [ ] Admin can process new and revision queues, corrections, media, merge, and history.
- [ ] Private images render only through authenticated same-origin no-store proxy.
- [ ] No private bearer token/URL enters HTML, optimizer, preload, or public cache.
- [ ] Conflicts/reasons are enforced by action and API.
- [ ] Unit, Playwright, lint, typecheck, and build pass.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Private media leaks through browser cache | Low | Critical | Critical | same-origin proxy + no-store + no optimizer; block release on proxy tests | Admin/Security |
| Accidental/stale approval | Medium | High | High | confirmation + visible diff + version conflict/no retry | Admin/API |
| UI tests not executed | Low | Medium | Medium | named existing Playwright spec; no unsupported TSX Vitest assumption | Admin |
| Server action bypass | Low | High | High | shared parse plus API RBAC/transaction | Admin/API |
