# Phase 6 Review — Admin Moderation Console

Reviewer: reviewer-p6
Date: 2026-07-30
Commits reviewed: `c6019ca` (feature), `00b5abb` (pending-get route + `adminProductEditDetailSchema`), `4b048b1` (report)
Branch: `feature/mobile-scan-product-creation`

## Verdict

**0 CRITICAL · 4 IMPORTANT · 9 MODERATE · 4 LOW**

The media proxy — the security core of this phase — is sound. No bearer leakage, no SSRF, no redirect-following, fail-fast before any upstream call, streamed body, no-store/nosniff forced. I could not construct a leak path.

The defects are in moderation *correctness and usability*: the two-request version composition silently grafts a different product's version onto merged rows, the rebase recovery UI submits an order the admin cannot see, and the most likely conflict codes on the approve path are unhandled dead ends.

## Verification Performed

| Gate | Result |
|---|---|
| `pnpm --dir apps/admin typecheck` | **PASS** (clean) |
| `pnpm --dir apps/admin test` (unit) | **PASS** — 35/35, 7 files |
| `pnpm --dir apps/admin build` | **PASS** — proxy route present in manifest at `/api/admin-product-media/[targetKind]/[parentId]/[photoId]/[variant]` |
| `pnpm --dir apps/admin lint` | **FAIL** (exit 1) — one pre-existing `@next/next/no-page-custom-font` warning in `src/app/layout.tsx` (commit `31e414a`, untouched by this phase) against `--max-warnings 0`. Report discloses this honestly. Not attributable to Phase 6; see M9. |
| `product-moderation.spec.ts` e2e (`ADMIN_E2E_PORT=4711 ADMIN_E2E_MOCK_PORT=4799`) | Full-suite runs failed 6/13 and 7/13 on this box, all with `Page crashed` / `net::ERR_ABORTED` / `page.goto` timeouts during login or navigation — **environmental**, load average 12–17 with 3.2 GB available on an 8 GB box shared with other teammates' dev servers. Re-running an isolated page test (`compares live vs proposed`) passed in 45.6 s. I could not reproduce any application-level e2e failure. See M8. |

Production ports 4000/4001 untouched; scratch ports confirmed free before and after; `test-results/` artifacts deleted; no source files modified.

**(g) ADMIN_E2E_PORT follow-up: LANDED IN WORKING TREE, NOT COMMITTED.** `apps/admin/playwright.config.ts` and `apps/admin/tests/e2e/admin-helpers.ts` are both dirty (`git status`) with the override support, including the correct `reuseExistingServer: !CI && !usingPortOverride` guard that prevents an override run from ever adopting a server already listening on 4001. I used it and it works. It must be committed — right now a clean checkout still hardcodes 4001.

---

## IMPORTANT

### I1 — `products.get()` grafts the *canonical* product's version and description onto a `merged_into` row

`apps/admin/src/lib/admin-api.ts:78-90`

The composition assumes `GET /v1/products/:id` returns the same row as `GET /v1/admin/products/:id`. It does not. `getVisibleProduct` (`api/src/services/products/product-visibility.ts:58-61`) resolves `merged_into` through `resolveCanonicalProduct` **before** the admin bypass, returning a *different product row* with a different `id`, `version`, and `description`.

Consequence on `/products/<loserId>` (reachable — the products list renders `merged_into` rows, `apps/admin/src/app/(admin)/products/page.tsx:19`):

- The page displays the loser's name/brand/status from the admin row but the **winner's** `description`.
- `ProductActions` receives the winner's `version` and sends it as the optimistic-concurrency token for a PATCH against the loser id (`product-actions.tsx:139`). The `updateMany where {id: loserId, version: winnerVersion}` guard is then comparing a version that never described that row — usually a spurious `version_conflict`, but on a version collision it is a **write whose stale-guard guarded nothing**. Same token flows into the merge tool (`merge/page.tsx:29`).

Recommendation: assert identity in the composition — `if (generalProduct.id !== id) …` — and either fall back to a non-composed read or surface an explicit "this product was merged into X" state. Do not silently spread fields from a row you did not ask for.

### I2 — Rebase renders the candidate list in a fixed order while submitting a different one

`apps/admin/src/app/(admin)/products/pending/recovery-actions.tsx:130` (`allCandidates.map`) vs `:106-112` (submits `order.map`)

The `<ul>` iterates `allCandidates` (immutable live-then-staged order). The ↑/↓ buttons mutate `order`, which is the array actually sent as `desiredPhotoOrder`. Nothing in the DOM reflects `order` — no reordering, no position index. Checking a previously-unchecked photo appends it to the end of `order`, also invisibly.

So the admin clicks "Move up", sees no change, and submits a photo order they were never shown. The phase spec requires "Rebase requires reviewed retained-photo mapping" and the component's own docstring claims the mapping is "never auto-computed" — but the admin cannot review what they are approving. Contrast `product-photo-manager.tsx:71` which correctly renders `order.map`.

Recommendation: render from `order` (with unchecked candidates in a separate section), or at minimum show the 1-based position per row.

### I3 — Rebase default state is invalid whenever live + staged photos exceed 5

`recovery-actions.tsx:70` seeds `order` with **every** candidate. `productEditRecoverRequestSchema` caps `desiredPhotoOrder` at `.max(5)` (`packages/shared/src/schemas/admin/products.ts:184`). A product with 5 live photos and any staged photo — or 3 + 3 — starts in a state that is guaranteed to 400.

The failure surfaces as `Action failed (validation_error).` — `actionErrorMessage` falls back to `result.detail`, and `toProblem`'s ZodError branch (`api/src/errors.ts:70-76`) sets no `detail`, only `errors`. The admin gets no indication that the cause is "too many photos selected".

Recommendation: enforce the 5-cap client-side (disable additional checkboxes at 5, show `n/5`) and either seed a valid default or start empty.

### I4 — Moderation panel is shown for `changes_required` products where every action is guaranteed to 409

`apps/admin/src/app/(admin)/products/[id]/product-actions.tsx:40` — `needsModeration = status === 'pending' || status === 'changes_required'`

`moderateProduct` rejects anything but `pending` (`api/src/services/products/product-moderation.ts:247-253`, 409 `conflict` "This product is not awaiting review"). This is not a corner case: `moderation-filters.tsx:36-42` ships a "Changes requested" option for the new-product queue, so an admin routinely lands on exactly these rows and finds Approve / Request Changes that always fail with `Action failed (conflict).` — no refresh affordance, no explanation.

Recommendation: gate the panel on `status === 'pending'` only, and render an explanatory state for `changes_required`.

---

## MODERATE

### M1 — Proxy passes upstream `Content-Type` through instead of forcing `image/webp`

`apps/admin/src/app/api/admin-product-media/[targetKind]/[parentId]/[photoId]/[variant]/route.ts:78`

```ts
'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
```

The plan constraint and this route's own comment ("Own headers set unconditionally, regardless of whether upstream already set them — this proxy is the last point of control") both say forced. Only `Cache-Control` and `X-Content-Type-Options` actually are.

Real risk today is low — both upstream routes hardcode `image/webp` (`api/src/routes/products/private-media.ts:65`, `edit-private-media.ts:46`) — but this is the last same-origin control point in front of admin-session bytes, and `nosniff` does not stop a browser honoring an explicit `text/html`. The e2e assertion `toBe('image/webp')` passes only because the mock also sends `image/webp`; it does not prove forcing.

Recommendation: hardcode `'Content-Type': 'image/webp'` and make the comment true.

### M2 — Only `version_conflict` gets conflict treatment; the approve path's realistic conflicts fall through

`apps/admin/src/lib/action-result.ts:26-36`, `pending-actions.tsx:37`

`PATCH /v1/admin/products/pending/:id` deliberately reads the edit fresh and supplies its own version token (`api/src/routes/admin/products/pending-resolve.ts:24-33`), so `version_conflict` is nearly unreachable on this route. What an admin will actually hit is:

- `edit_base_stale` (409, `api/src/services/products/product-edits.ts:68-75`) — the live product moved since load; the correct next step is rebase/supersede
- `conflict` "Already resolved" (`pending-resolve.ts:26`)

Both render as `Action failed (<code>).` with no Refresh button and no pointer to recovery. The plan's "conflicts require refresh/re-review" is satisfied for the one code that rarely fires and missed for the two that will.

Recommendation: treat `edit_base_stale` and `conflict` as conflict states — show the refresh affordance, and for `edit_base_stale` direct the admin to the recovery actions.

### M3 — Two-request composition is non-atomic; the version can be newer than the data shown

`admin-api.ts:80-90` — `Promise.all` of two independent reads. If the product is mutated between them, the page renders the admin row's (older) fields alongside a version from the later read. A subsequent PATCH then succeeds against content the admin never saw — the precise blind-write the token exists to prevent.

Narrow window, no data loss beyond a single overwritten correction, but it is a genuine weakening of the guarantee the workaround was meant to preserve. Worth recording as accepted risk if not fixed; the clean fix remains adding `version` to `adminProductRowSchema`.

*(Positive, for calibration on the approved workaround: the composition is correctly single-item only. `products.get` is called from exactly three page-level sites — `[id]/page.tsx:16`, `[id]/merge/page.tsx:20`, `pending/[editId]/page.tsx:17` — never inside a list map. No N+1. The queue is 2 upstream requests regardless of row count, and version tokens are end-to-end real, never fabricated.)*

### M4 — Age filter silently disables pagination and only filters the current page

`apps/admin/src/app/(admin)/products/pending/page.tsx:61-64, 101-102`

The age buckets are applied to the already-fetched page, then `nextCursorNew`/`nextCursorRevision` are hard-nulled when `age` is set. An admin filtering "older than 72h" over a backlog larger than one page sees only the matches within page 1 and gets no "Load more" — with no indication that results were truncated. For a moderation SLA filter ("what's been waiting longest") this is the wrong answer, not a slower one.

Separately, merging two independently-cursored sources and sorting within the page means global `createdAt` ordering is only correct on page 1 even without the age filter.

Recommendation: at minimum surface "filtered within this page" in the UI; better, push age to the API as a query param.

### M5 — Queue search params are forwarded to the API unvalidated

`pending/page.tsx:41-52` — `sp.status`, `sp.cursorNew`, `sp.cursorRevision` go straight into the upstream query string. No injection risk (`qs()` uses `URLSearchParams`, `admin-api.ts:47-52`), but an arbitrary `?status=bogus` produces an upstream 400 that propagates as an unhandled throw out of the Server Component → generic error page. The phase spec asks for "a server-rendered queue from validated URL search params".

Recommendation: parse the search params with a small zod enum/`safeParse` and fall back to defaults.

### M6 — `pending-get` returns any edit regardless of status, including unsubmitted creator drafts

`api/src/routes/admin/products/pending-get.ts:26-31`

No `status` filter. `/v1/admin/products/pending/<draftEditId>` renders a creator's never-submitted private draft in the moderation console. `recoverProductEdit` explicitly refuses to act on `draft` ("a never-submitted draft cannot be pushed into the moderation queue this way", `product-edits.ts:613-615`), which shows the intended boundary; this read route doesn't enforce it. The plan's private-draft posture is about non-admin users, so this is a scope question rather than a leak — but it should be a decision, not an omission.

Otherwise (c) checks out: admin-gated via `adminOnlyPlugin` (`api/src/routes/admin/index.ts:43`, registered at `:56`), parsed against `adminProductEditDetailSchema`, exposes `liveProductVersion` for staleness, and `submittedBy` is the only added identity field.

### M7 — E2E mocks are hand-shaped and never validated against the shared schemas

`apps/admin/tests/e2e/mock-store.ts`, `mock-admin-handlers.ts`, `mock-product-handlers.ts`

The mock builders (`fullProductDto`, `editListRow`, `creatorEditRow`, `editDetailRow`) construct response objects literally. Nothing parses them against `productSchema` / `productEditRowSchema` / `adminProductEditDetailSchema` on the way out. Client-side `.parse()` catches a mock that is *narrower* than the contract, never one that diverges in a way the client happens to tolerate.

This is not hypothetical: `productSchema` is non-strict, so the real `GET /v1/products/:id` extra field `topReviews` (route returns `productWithReviewsSchema`, `api/src/routes/products/get.ts:23-26`) is stripped silently — the mock omits it and the suite would never have caught it had the schema been strict. The implementer's own report documents three separate mock-shape bugs found only by running the UI.

Recommendation: have each mock handler `schema.parse()` its own response before returning. Drift then fails loudly in the mock, where it is cheap.

### M8 — E2E spec asserts happy paths; the security and conflict properties it claims are largely untested

`apps/admin/tests/e2e/product-moderation.spec.ts`

Against the phase spec's own Task 1/Task 3 test list, missing:

- **Staged-edit (`kind=edit`) proxy bytes** — only `product` is exercised, though the `edit` upstream prefix is half the proxy's surface.
- **Invalid `variant` and non-UUID `parentId`/`photoId`** — only an invalid `targetKind`.
- **The route's own 401.** The anonymous test (`:134`) asserts a middleware 307 to `/login`, which never reaches the handler. The `if (!access) return errorResponse(401)` branch and its "zero upstream requests" property have no coverage.
- **Empty error body / no upstream leak** — the 404 tests assert status and `cache-control` but never that the body is empty.
- **No redirect following** — untested; the mock never redirects.
- **Any `version_conflict` path.** The mocks emit `version_conflict` from five handlers (`mock-admin-handlers.ts:230, 269, 284, 333`) and no spec ever triggers one. "Conflict refresh, never auto-retry" is a named acceptance criterion of this phase and is unproven end-to-end. Same for `identifier_conflict` (`:294`).
- **Keyboard reorder** — the report claims keyboard-accessible reordering; only Remove is tested. Had ↑/↓ been asserted, I2 would have been caught.

Flakiness note: `waitForURL(..., 15_000)` and default 5 s expects give no headroom; under load this suite is unreliable (see Verification). Consider raising the spec-level timeout.

### M9 — Repo-level `pnpm --dir apps/admin lint` does not pass

The Phase 6 gate lists `pnpm --dir apps/admin lint` as a required PASS. It exits 1. The cause is genuinely pre-existing and out of this phase's scope, and the report says so plainly rather than claiming a pass — that is the right call. But the gate is still red, and every subsequent phase inherits it. Someone should either fix `layout.tsx` or drop `--max-warnings 0` deliberately; leaving a permanently-failing gate trains people to ignore it.

---

## LOW

### L1 — Retained-photo URL fallback would 404

`apps/admin/src/app/(admin)/products/[id]/revision-comparison.tsx:81` builds `product/<liveId>/photos/<p.id>` for a retained photo, but `p.id` is the **`ProductEditPhoto`** id, not the `ProductPhoto` id (`api/src/services/products/product-edits.ts:83, 93`). Harmless today because retained photos carry absolute CDN URLs and `resolveAdminPhotoUrl` short-circuits on `^https?://`. It breaks only in `toApiEditPhoto`'s own "should never execute" branch (`:92-98`), where the URL is relative. If that branch is truly unreachable, consider deleting it; otherwise pass `sourceProductPhotoId` through the DTO.

### L2 — No approve confirmation

Phase spec Task 3: "approve/request changes with confirmation/reason". Request-changes has its reason gate; approve fires immediately on a single click in both `product-actions.tsx:101` and `pending-actions.tsx:88`. Approving publishes to the live catalog. Remove/supersede/merge do confirm.

### L3 — No focus management on the request-changes reason input

`pending-actions.tsx:44`, `product-actions.tsx:70` — toggling into the reason form does not move focus to the input. Native `window.confirm` handles focus for the destructive paths, so there is no custom dialog needing focus return, but the report's "accessible dialogs/focus return" claim overstates what is implemented.

### L4 — Proxy has no upstream timeout

`route.ts:57-65` — no `AbortSignal.timeout`. A hung API holds a Next server connection until the platform kills it. Shared with `apiServerFetch` (pre-existing), so fix as a pair if at all.

Minor, no action needed: a 200 with an empty body falls into `errorResponse(upstream.status)` and returns 200 without the `nosniff`/content-type headers (`route.ts:74`); `runAction` collapses non-`ApiError` throws — including response `ZodError`s — into `unknown_error` (`actions.ts:39`), hiding contract drift behind a generic message.

---

## Media Proxy Assessment (a) — Clean

Checked against every property the plan names. Evidence in `apps/admin/src/app/api/admin-product-media/[targetKind]/[parentId]/[photoId]/[variant]/route.ts`:

| Property | Status |
|---|---|
| Strict `targetKind`/`variant` enums + UUID `parentId`/`photoId` before any upstream call | ✅ `:6-11`, `:43-45` — `safeParse` → 404, ahead of everything |
| Admin cookie required, 401 with zero upstream requests | ✅ `:47-49` — cookie read and 401 precede the `fetch` at `:57` |
| Bearer attached server-side only | ✅ `:59` header; never in the URL, never echoed, no logging anywhere in the file |
| Streams, no buffering | ✅ `:74` passes `upstream.body` (a `ReadableStream`) straight to `NextResponse` |
| `no-store` + `nosniff` forced regardless of upstream | ✅ `:79-80`, and `errorResponse` (`:27`) sets `no-store` on every failure path |
| Forced `image/webp` | ⚠️ **M1** — passthrough with fallback |
| Upstream 404 → clean 404, no error-body leak | ✅ `:72` returns `errorResponse(upstream.status)` — status only, body `null`, upstream headers dropped entirely |
| No redirect following | ✅ `redirect: 'manual'` (`:64`) plus explicit `opaqueredirect`/3xx → 502 (`:68-70`); no `Location` ever forwarded |
| No SSRF | ✅ Only UUID-validated segments interpolate into a server-config `apiBaseUrl`; no scheme/host/path-traversal reachable |

No `next/image` anywhere near private media — every render site uses a plain `<img>` with a scoped eslint-disable (`product-photo-manager.tsx:74`, `revision-comparison.tsx:66,79`, `recovery-actions.tsx:145`), and `resolveAdminPhotoUrl` (`admin-media.ts:29-38`) routes anything non-absolute through the proxy.

## Contract Check (b) — Correct

Every action verified against the real API schema and route, not the mock:

- `moderate` → `POST /v1/admin/products/:id/moderate` `{decision, version, notes}` matches `adminProductModerateRequestSchema` (`packages/shared/src/schemas/admin/products.ts:147-156`) ✅
- `resolveEdit` → `PATCH /v1/admin/products/pending/:id` `{decision, notes}` matches `adminProductEditResolveSchema` — correctly **no** client version, because the route supplies its own (`pending-resolve.ts:24-33`) ✅; response discrimination (`productSchema` on approve, `productEditRowSchema` on request_changes) matches `resolveProductEdit`'s union return (`product-edits.ts:596-604`) ✅
- `merge` → `{targetId, sourceIds, version}` matches `adminProductMergeSchema:71-76`; route rejects `targetId !== :id` ✅
- `patch` → version injected, matches `adminProductPatchSchema:58-66` ✅
- `recoverEdit` → discriminated `rebase`/`supersede` with `editVersion`/`productVersion`, both real (`revision.version`, `revision.liveProductVersion`), matches `productEditRecoverRequestSchema:179-196` ✅
- Request-changes reason required client-side (`disabled` until `notes.trim()` non-empty) and server-side (`.refine`) ✅
- No auto-retry anywhere — every conflict path requires an explicit user action ✅
- Duplicate submit: `disabled={pending}` on every mutating control across all five components ✅
- Structured `identifierConflict` surfaced with slot and both values ✅ (the merge contract offers no resolution choice, so display-only is complete)

## Theme (f) — Clean

Zero hard-coded hex in the diff. Alert Red (`--expired: 9 75% 52%` = `#E0442A`, `globals.css:31,44`) appears only via `variant="destructive"` on Supersede (`recovery-actions.tsx:176`) and Merge (`merge-tool.tsx:127`), and `text-expired` on Remove (`product-photo-manager.tsx:103`) — all genuinely destructive. Request Changes uses `variant="accent"` (Honey) in both places (`product-actions.tsx:103`, `pending-actions.tsx:88`), which is exactly the distinction the Button component documents at `button.tsx:12-16`. Changed-field highlight uses `bg-accent-light/40` (`revision-comparison.tsx:24`). No scope creep in the diff — 24 files, all within the phase's declared ownership.

## Recommended Order

1. I1 (wrong-row version token) — correctness of the concurrency guard
2. I4 (dead moderation controls) — routinely reachable
3. I2 + I3 (rebase order invisible, default over cap) — recovery is unusable as shipped for >5 candidates and unreviewable for any
4. M2 (unhandled `edit_base_stale`/`conflict`) — small change, closes the conflict-UX gap
5. M1 (force content-type) — one line
6. Commit the `ADMIN_E2E_PORT` working-tree change
7. M8 test gaps: at minimum a `version_conflict` refresh path, an `edit`-kind proxy fetch, and a keyboard-reorder assertion
8. M4, M5, M6, M7, M3, then LOWs

## Unresolved Questions

1. **M6** — should admins be able to open a creator's unsubmitted `draft` revision through `/v1/admin/products/pending/:editId`? Product decision, not a code bug.
2. **I1** — what *should* `/products/<merged_into_id>` show? Redirect to canonical, or a read-only historical view? Needed before the fix can be scoped.
3. **M3** — accept the non-atomic composition as documented risk, or add `version` to `adminProductRowSchema` (a Phase 1/4-owned file) in a follow-up?
