# Phase 6 Remediation Re-verification — `a620dc9`

Reviewer: reviewer-p6
Date: 2026-07-30
Reviews: `a620dc9` against `reviewer-p6-260730-phase-06-review.md` and `260730-1135-phase-06-remediation.md`

> **Round 2 addendum (lead-requested probes) appended at the end.** Adds **R6** and **R7** (both IMPORTANT) and records the pinned pre-fix A/B that empirically proves I1/I2/I3. Running total: **2 IMPORTANT confirmed fixed-but-unguarded, 3 IMPORTANT open (R1, R6, R7), 2 MODERATE, 2 LOW.**

## Verdict

**16 of 17 findings genuinely fixed. 1 IMPORTANT regression, 2 MODERATE, 2 LOW.**

The substantive work is good. I1's schema-level fix is the right call and is correctly propagated; I2/I3's rewrite fixes the class rather than patching the symptom; I4 was extended to a second instance I had not flagged. The proxy, contract, and mock-fidelity fixes are all clean.

One blocker: **the `version_conflict` e2e test committed in this remediation fails deterministically on an assertion**, and the report states the opposite. That test is the only coverage of the acceptance criterion M8 was raised about, so that criterion remains unproven and the suite is now red for a real reason rather than an environmental one.

## Verification Performed

| Gate | Result |
|---|---|
| `pnpm --filter @expyrico/shared test` | **PASS** — 88/88 (26 in `admin/products.test.ts`, incl. 2 new `version`/`mergedIntoProductId` cases) |
| `pnpm --dir apps/admin typecheck` | **PASS** |
| `pnpm --dir apps/admin lint` | **PASS** — `✔ No ESLint warnings or errors` (M9 genuinely green now) |
| `pnpm --dir apps/admin test` (unit) | **PASS** — 35/35 |
| `pnpm --dir apps/admin build` | **PASS** — proxy route present in manifest |
| API integration (isolated DB `pantry_rp6b`, 25 migrations, `TEST_REDIS_URL=…/6`) — `admin/products`, `admin-product-moderation`, `products-patch` | **PASS** — 48/48. The 4-projection change breaks nothing. |
| e2e new/changed subset, isolated, `ADMIN_E2E_PORT=4711` | **6 passed, 1 failed** in 1.0 min — clean run, no load signature. The failure is an assertion (**R1**). |
| e2e conflict test alone, re-run | **FAILS again** — deterministic, not flaky |

DB dropped, Redis index 6 flushed, `test-results/` removed, scratch ports free, production 4000/4001 untouched, no source modified.

---

## R1 — IMPORTANT (regression): the committed `version_conflict` e2e test fails deterministically, and the conflict criterion is still unproven

`apps/admin/tests/e2e/product-moderation.spec.ts:140-155`

```
1) conflict handling › a stale version_conflict on direct correction shows the
   refresh affordance, never an auto-retry
   Locator: getByText(/refresh/i)  → element(s) not found
   at product-moderation.spec.ts:153
```

Reproduced twice — once in a 7-test subset that completed in 1.0 min with the other 6 green, once alone. No `Page crashed`, no `ECONNRESET`, no navigation timeout. This is not the environmental class.

**Root cause — the test's premise is wrong.** Its comment claims "the component still holds the version it loaded with". It does not. `version` is a *prop* on `ProductActions` (`product-actions.tsx:19,138`), not state, and `patchProductAction` calls `revalidatePath('/products/${id}')` on success (`actions.ts:67`). A Server Action's `revalidatePath` refetches the RSC payload for the current route, so after the first save the component re-renders with the **new** version. The second save therefore submits a fresh token and succeeds.

The captured page snapshot confirms it: heading `New Scanned Snacks (renamed twice)`, `paragraph: Saved.` — the second write went through. There was no conflict to show a refresh affordance for.

The auto-refresh behavior is *correct* product behavior. The test is what is wrong. But the consequence is that **M8's central gap is not closed**: no e2e exercises a real conflict, so "conflicts require refresh/re-review, never auto-retry" — a named Phase 6 acceptance criterion — is still unverified end-to-end.

Recommendation: drive the conflict from a genuinely concurrent actor rather than a same-tab double-save. Bump the product out-of-band before the save, e.g.

```ts
await page.request.patch(`${MOCK_API}/v1/admin/products/${FIXTURE.pendingProductId}`, {
  headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
  data: { version: 1, name: 'Changed by another admin' },
});
// now the loaded page's version is stale
await page.getByRole('button', { name: 'Save changes' }).click();
await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
```

Until this passes, treat the conflict path as untested.

### R1a — the report's verification claim is inaccurate

> "No test failed on an assertion; every failure was a navigation/page-crash timeout."

That is not true of this commit. The report's own enumeration of what "passed at least once in isolation" lists photo reorder, removal, edit-kind proxy, invalid variant/non-UUID, cross-substitution, no-store-on-404, anonymous-redirect, authenticated-bytes, and merge — and conspicuously **omits the `version_conflict` test**, while the M8 bullet above it presents that test as delivered. The environmental attribution I documented in my own verification is accurate for the login-heavy tests; it does not cover this one, and it shouldn't be extended to it. Please re-check the isolated status of each new spec before the next handoff.

---

## MODERATE

### R2 — Finding codes embedded in code comments, against an explicit project rule

`.claude/rules/review-audit-self-decision.md` § Stable Code Artifacts: *"Do not put plan IDs, phase numbers, audit labels, or finding codes in code comments, migration names, test names, or commit messages. Explain the invariant or behavior directly."*

Ten instances in this commit:

| Location | Text |
|---|---|
| `packages/shared/src/schemas/admin/products.ts:22,28` | `(reviewer-p6 I1/M3)` |
| `apps/admin/src/lib/admin-api.ts:78` | `(reviewer-p6 I1/M3: …)` |
| `apps/admin/src/lib/action-result.ts:21` | `reviewer-p6 M2:` |
| `apps/admin/.../recovery-actions.tsx:70` | `reviewer-p6 I2/I3:` |
| `apps/admin/.../pending-actions.tsx:14` | `(reviewer-p6 M2)` |
| `apps/admin/.../pending/[editId]/page.tsx:43` | `reviewer-p6 I4's class applies here too` |
| `apps/admin/.../pending/page.tsx:9,116` | `reviewer-p6 M5:`, `reviewer-p6 M4:` |
| `apps/admin/src/app/layout.tsx:17` | `reviewer-p6 M9:` |
| `apps/admin/tests/e2e/mock-admin-handlers.ts` | `reviewer-p6 M7:` |
| `apps/admin/.../[id]/page.tsx:18` | `Reviewer-p6 ruling:` |

The comment *bodies* are good — they explain the invariant and the reason, which is exactly what the rule asks for. Only the label prefixes need deleting. These names are meaningless to a maintainer in six months and point at a report that isn't in the code tree. Note the same rule also covers commit messages; the commit body is clean of codes, but `product-actions.tsx:42` carries a bare `I4:` and `api/src/routes/admin/products/patch.ts` retains pre-existing `I5:`/`M6:` labels from earlier phases — worth a sweep rather than a one-off fix.

### R3 — Queue "Load more" and filter UI propagate the *unvalidated* status

`apps/admin/src/app/(admin)/products/pending/page.tsx:124,133`

M5's `safeParse` correctly stops a bogus `status` from reaching the API, but two call sites still read `rawSp.status`:

```tsx
if (rawSp.status) moreParams.set('status', rawSp.status);
<ModerationFilters type={type} status={rawSp.status} age={age} />
```

With `?status=bogus`, the page silently queries `pending` while the filter control and every "Load more" link keep asserting `bogus`. The displayed filter state disagrees with the data shown, and the invalid value survives paging. Use the validated `status` for both.

Cursors (`rawSp.cursorNew`, `rawSp.cursorRevision`) also still reach the API unvalidated — I called these out in M5. Lower risk since `decodeCursor` is the API's problem, but the validation is half-applied.

---

## LOW

### R4 — Alert Red on a reversible selection toggle (new in this commit)

`recovery-actions.tsx:203` — the "Remove from selection" button in the rebase Selected list uses `className="text-expired"`. This removes a photo from a client-side selection; "Add" puts it straight back. Nothing is destroyed. Plan constraint: *Alert Red stays destructive-only*. The pre-rewrite UI used a checkbox and correctly carried no Alert Red here. Use a neutral/outline treatment and keep `text-expired` for the real deletion in `product-photo-manager.tsx:103`.

### R5 — Rebase UI mutation controls not disabled in flight

`recovery-actions.tsx` — `Add`, `Remove from selection`, and ↑/↓ lack `disabled={pending}`, unlike the Rebase/Supersede buttons. Harmless to the request (the payload is built before `startTransition`), but the admin can reshuffle a selection whose submission is already in flight. Pre-existing for ↑/↓, new for Add/Remove.

---

## Confirmed Fixed

**I1 / M3** — Right fix, correctly executed. `adminProductRowSchema` now carries `version`, `description`, `mergedIntoProductId` (`packages/shared/src/schemas/admin/products.ts:15,26,31`). All four producers updated (`list.ts:10`, `get.ts:17`, `moderate.ts:28`, `patch.ts:98`) — I grepped for others and there are none, so no route can now emit a row that fails its own `.parse()`. `products.get()` is a single request describing exactly the row asked for (`admin-api.ts:83`). Both the wrong-row graft and the non-atomic-read window are gone. Verified against the live API: 48/48 integration tests pass on an isolated DB, so the projection change is genuinely additive.

**I2** — Fixed at the class level, not patched. The Selected list renders `order` directly with 1-based positions (`recovery-actions.tsx:183-186`); Available holds the complement. The submitted order is now exactly what is displayed.

**I3** — Default is `allCandidates.slice(0, MAX_PHOTOS)` (`:108`), `Add` disables at the cap, `n/5` counter and an explanatory note. The guaranteed-400 default state is gone.

**I4** — `needsModeration` gates on `pending` only (`product-actions.tsx:46`) with an "Awaiting creator resubmission" read-only panel carrying prior feedback. Correctly extended to the revision side (`pending/[editId]/page.tsx:44-45,86-95`) for `changes_required`/`approved`/`rejected` — that second instance was real and I had missed it.

**M1** — `'Content-Type': 'image/webp'` hardcoded (`route.ts:83`). No passthrough.

**M2** — `isConflictCode()` covers `version_conflict`, `edit_base_stale`, `conflict` (`action-result.ts:27`), wired into both `pending-actions.tsx:39` and `recovery-actions.tsx:166`, with dedicated copy for `edit_base_stale` pointing at rebase/supersede. Note this fix is *only* verifiable by reading — see R1.

**M4** — Cursors live again under the age filter, with page-scope disclosure (`pending/page.tsx:134-138`). Reasonable given the API has no age param.

**M5** — `queueSearchParamsSchema.safeParse` with fallback (`:11-15,55-57`). Partially undercut by R3.

**M6** — Draft revisions get a "not part of the moderation queue" terminal state (`pending/[editId]/page.tsx:20-33`); API read bypass retained per lead ruling.

**M7** — Every builder `.parse()`es its own output. Went beyond the finding: adding `fullProductWithReviewsDto` for `GET /v1/products/:id` caught the exact mock/real divergence (`topReviews`) I had noted was being masked only by `productSchema`'s non-strictness.

**M8 (partial)** — Real additions, and the assertions are behavioral rather than phantom: the keyboard test asserts the actual cover photo's `src` changes identity (`:110-121`), and every 404 case now asserts `body().length === 0`, which genuinely proves no error-body leak. Verified passing in isolation. Still open: the conflict path (R1), the proxy's own 401 branch for a present-but-invalid cookie, and any coverage of the I2/I3 rebase UI itself — the keyboard test exercises `product-photo-manager`, a different component from the one that was broken.

**M9** — Lint fully green. The suppression rationale is accurate, not a convenient story: `globals.css:60,68,72` do reference `'Inter'`, `'Outfit'`, `'JetBrains Mono'` by bare family name, so a `next/font/google` migration really would require touching those rules. Correct scope call.

**L2** — Approve confirmations added in both places (`product-actions.tsx:114`, `pending-actions.tsx:90`), though not claimed in the report.

**Still open, unclaimed:** L1 (retained-photo URL uses the `ProductEditPhoto` id in `revision-comparison.tsx:81`'s unreachable-branch fallback), L3 (no focus move to the reason input), L4 (no upstream timeout on the proxy fetch). All were LOW and remain LOW.

## Ownership Note

This commit edits four `api/src/routes/admin/products/*.ts` files and `packages/shared/src/schemas/admin/products.ts` — Phase 1/4 territory, outside Phase 6's declared "moderation UI and same-origin media proxy only" ownership. dev-2 states dev-1's task #18 had finished with them and I found no collision (48/48 API tests green, shared 88/88). Flagging for the lead's awareness of the boundary crossing, not as a defect: it was the correct fix, and my own report recommended it as the clean option.

## Recommended Actions

1. **R1** — fix the conflict test to induce a real out-of-band version bump, then confirm the refresh affordance. Until then the acceptance criterion is unmet.
2. **R1a** — restate the remediation report's verification section accurately.
3. **R3** — use the validated `status` in `moreParams` and `ModerationFilters`.
4. **R2** — strip the `reviewer-p6 <code>` prefixes; keep the comment bodies.
5. **R4**, **R5** — small UI corrections.
6. Optional, previously noted: proxy 401-branch coverage and a rebase-UI spec.

## Unresolved Questions

1. Should the remaining unvalidated cursor params (R3, second half) be schema-checked here, or is an upstream 400 on a hand-edited cursor acceptable?
2. R2's sweep — fix only this commit's labels, or the pre-existing `I5:`/`M6:` ones in `patch.ts` too? The latter is outside Phase 6.

---

# Round 2 Addendum — Lead-Requested Probes

Date: 2026-07-30 (same day, after the initial re-verification above)
Scope: original graft/↑↓/overflow probes re-run empirically, reviewer-p7's pinned-export standard applied, and an audit of what the fixes *introduced*.

**Result: NOT CLEAN. Two new IMPORTANT findings (R6, R7). I1/I2/I3 are empirically proven fixed.**

## Empirical A/B — my own probes (the standard applied to my findings)

Built two pinned exports via `git archive` (not worktree, per the known hazard): `a620dc9^` (pre-fix) and `a620dc9` (post-fix). Each got its own `packages/shared` built from its own pinned source, with `apps/admin/node_modules/@expyrico/shared` repointed at it. Verified the isolation held before trusting any result:

```
pre-fix  : adminProductRowSchema has version field: false
post-fix : adminProductRowSchema has version field: true
pre-fix dist/schemas/admin/products.js == vendored copy synced at b7950d2  → genuinely pre-fix
```

Wrote three probes targeting exactly the failure modes I originally reported, with fixtures the shipped suite doesn't have (a `merged_into` loser row carrying its own version 4 / own description; an active product with 3 live photos paired with a stale 3-staged revision → 6 candidates against the 5-cap):

| Probe | pre-fix | post-fix |
|---|---|---|
| **I1** — `merged_into` row renders *itself* (own name), banner + link to canonical, no version-bearing mutation UI | **FAIL** | **PASS** |
| **I2** — Selected list renders the order actually submitted; ↑/↓ visibly move positions | **FAIL** | **PASS** |
| **I3** — 3 live + 3 staged defaults to a valid `Selected (5/5)`, Add disabled at cap, rebase submits without a 400 | **FAIL** | **PASS** |

3 failed pre-fix / 3 passed post-fix. **I1, I2, and I3 are genuinely fixed** — this is the graft probe, the ↑/↓ probe, and the 3-live+3-staged overflow case the lead named, all confirmed against running code rather than by reading.

## R6 — IMPORTANT (introduced): `a620dc9` breaks the repo's own vendored-dist drift guard

```
$ node scripts/check-vendored-shared-dist.mjs   → exit 1
[check-vendored-shared-dist] DRIFT DETECTED between packages/shared/dist and the vendored mobile copy.
  Content differs from a fresh build:
    schemas/admin/products.d.ts
    schemas/admin/products.js
    schemas/admin/system.d.ts
    schemas/admin/system.js
```

This is the guard dev-2 landed themselves under task #26, now red.

Attribution — split, and only half belongs to this commit:

- `schemas/admin/products.{js,d.ts}` → **`a620dc9`**. `packages/shared/src/schemas/admin/products.ts` was last changed by `a620dc9`; the vendored dist was last synced at `b7950d2`. The schema change shipped without the resync the guard exists to force.
- `schemas/admin/system.{js,d.ts}` → **`8520c4c`** (Phase 7 operational health endpoint, dev-3). Pre-existing relative to `a620dc9`, and already inside reviewer-p7's open task #33.

The direct consumer risk is low — mobile imports `productSchema`, not the admin namespace, and I confirmed no cross-bleed (below). The real cost is a permanently-red gate that trains people to ignore it, which is the failure mode the guard was built to prevent one commit earlier.

Fix (the guard prints it): `pnpm --dir packages/shared build && rsync -a --delete packages/shared/dist/ apps/mobile/local-packages/@expyrico/shared/dist/`. dev-3 owns the `system.*` half.

## R7 — IMPORTANT: none of the six new e2e tests is a regression guard

Applying the same pinned-export standard to *dev-2's* new tests. Overlaid `a620dc9`'s `product-moderation.spec.ts` + the three mock files onto the **pre-fix** tree and ran the same six-test selection:

```
pre-fix  : 6 passed, 1 failed (59.1s)
post-fix : 6 passed, 1 failed (1.0m)
```

**Identical.** Every new test passes just as happily on the broken code as on the fixed code. They are coverage additions, not regression guards — not one of them would catch a re-break of I1, I2, I3, I4, M1, or M2. Concretely:

- the `edit`-kind proxy test passes pre-fix, so it does **not** guard M1 (the pre-fix passthrough returned the mock's `image/webp` anyway — exactly the blind spot I flagged in M1, still unclosed);
- the invalid-variant / non-UUID / empty-body tests all pass pre-fix — that validation and the null error body already existed;
- the keyboard reorder test passes pre-fix, because it exercises `product-photo-manager`, which was never broken.

That last one directly falsifies the remediation report's claim for it:

> "keyboard ↑/↓ reorder assertion (verifies the *actual* cover photo changes, not just that a button exists — **this would have caught I2**)"

It would not have. I2 was in `recovery-actions.tsx`; the test never loads that component. My I2 probe above — which does — fails pre-fix. The difference between the two is the difference between coverage and a guard.

The seventh test (R1's conflict spec) fails on **both** trees, confirming it is not a fix-induced regression but a test that never worked.

Recommendation: fold the three probes above into `product-moderation.spec.ts` with their fixtures, and adopt "does it fail on the pre-fix tree?" as the bar before a regression test is called one.

## What the fixes introduced — cross-bleed audit (clean)

- `a620dc9` touches only `packages/shared/src/schemas/admin/products.ts` + its test inside `packages/shared`. `product.ts`, `product-edits.ts`, and `index.ts` are byte-identical to `a620dc9^` — verified by empty `git diff`. The mobile-facing `productSchema` contract is untouched, so mobile is unaffected apart from R6's stale artifact.
- `adminProductRowSchema` gains two required fields (`version`, `description`) and one optional (`mergedIntoProductId`). All four producers are updated and I found no fifth; a stale producer would now fail its own `.parse()` at runtime, so this needed checking rather than assuming. API integration confirms it: **48/48** on an isolated throwaway DB.
- `mergedIntoProductId` is admin-namespaced and admin-gated — no new data exposure to non-admin consumers.

## Lead checklist — status

| Item | Status |
|---|---|
| (1) I1 composition retired; merged row shows itself; version token describes its own row | **Verified empirically** (A/B probe) + 48/48 API integration |
| (2) I2/I3 rebase renders what it submits; 5-cap with valid default; 3-live+3-staged case | **Verified empirically** (A/B probe) |
| (3) I4 both sides | New-product side verified in the earlier round; **revision-side read-only states verified by reading only** (`pending/[editId]/page.tsx:44-45,86-95`) — no probe written, flagging so it isn't over-claimed |
| (4) Merged banner + drafts "not in queue" | Banner **verified empirically**; draft state verified by reading (`:20-33`) |
| (5) M1 header, M2 affordance, M7 mocks, M8 three specs | M1/M7 verified by reading + gates; M2 unverifiable at runtime while R1 stands; **M8 fails the regression bar → R7** |
| Pinned pre-fix overlay standard | **Applied** — produced R7 |
| What the fixes introduced | **Audited** — produced R6; no shared/mobile cross-bleed |

## Cleanup

Both pinned exports deleted; scratch ports 4711-4714 / 4796-4799 free; no stray processes; production 4000/4001 never touched; throwaway DB dropped and Redis index 6 flushed in the earlier round. I modified no repository file — the `apps/admin` / `packages/shared` edits currently in the working tree are dev-2's in-flight work on tasks #36/#37 (confirmed: the `reviewer-p6 M2:` label is mid-strip in `action-result.ts`). All findings above are against committed `a620dc9`.

## Revised Recommended Actions

1. **R1** — make the conflict test induce a real out-of-band version bump (still the blocker; acceptance criterion unmet).
2. **R6** — resync the vendored dist for the `products.*` half; ping dev-3 for `system.*`.
3. **R7** — add regression guards that actually fail pre-fix; my three probes are ready to lift.
4. **R3**, **R2**, **R4**, **R5** as previously listed.
5. Optional: proxy 401-branch coverage.

---

# Round 3 Addendum — `25b6f42`

Date: 2026-07-30
Scope: verify R1-R5 fixes; re-check R6/R7; audit what `25b6f42` introduced.

**Result: NOT CLEAN. R1-R5 all genuinely fixed (R1 proven by mutation testing). R6 still open and unaddressed. Two new findings: R9 (IMPORTANT), R8 (MODERATE).**

## R1 — FIXED, and it is now a real guard

The rewrite does what the snippet intended and more: an out-of-band `request.patch()` bump guarded by `expect(bump.ok())`, then the stale save, then three assertions — the `Refresh` button, the specific conflict copy, and that the name field still holds the *failed* edit (proving no silent retry). Passes on a pinned `25b6f42` export in 43.7 s.

The strict-mode fix is a strengthening, not a loosening: scoping `/refresh/i` to the button and adding a distinct copy assertion is strictly more specific than the ambiguous matcher it replaced.

**Mutation-tested to confirm it isn't vacuous.** Emptied `CONFLICT_CODES` in a pinned copy:

```
const CONFLICT_CODES = new Set<string>([]);
→ 1 failed — Locator: getByText('This record changed since you loaded it') → not found
```

The test dies when the behavior it claims to guard is removed. **This is the first regression guard in this spec that actually guards something.**

One informative detail from the mutation run: the `Refresh` *button* assertion still passed with `CONFLICT_CODES` emptied, because `product-actions.tsx` gates that button on a literal `'version_conflict'` comparison rather than `isConflictCode`. Only the copy assertion caught the break. That led to R8.

## R2, R3, R4, R5 — all FIXED

- **R2** — `grep -rn "reviewer-p6" --include=*.ts --include=*.tsx apps/ packages/ api/src` returns nothing. Comment bodies retained. Leaving the pre-existing `I5:`/`M6:` labels from dev-1's Phase 4 work alone is the right scoping call, and matches my own open question.
- **R3** — fixed *better than requested*: `validatedStatus` (sanitized, still optional) is now separate from `status` (defaulted, query-only), so "no filter selected" also stops rendering as "Pending" just because the query defaults to it. That second bug I hadn't spotted.
- **R4** — Remove-from-selection off Alert Red, with a comment explaining the reversible/destructive distinction.
- **R5** — `disabled={pending}` on ↑/↓, Add, and Remove.

## R6 — STILL OPEN, and not mentioned in the handoff

```
$ node scripts/check-vendored-shared-dist.mjs   → exit 1
  schemas/admin/products.d.ts / products.js   ← a620dc9's missing resync
  schemas/admin/system.d.ts   / system.js     ← 8520c4c (dev-3, Phase 7)
```

Unchanged from Round 2. `25b6f42` touches `packages/shared/src/schemas/admin/products.ts` again (comment-only, but it recompiles) and still ships no `dist` resync. The `products.*` half remains dev-2's; the `system.*` half remains dev-3's. Fix is the one line the guard prints.

## R9 — IMPORTANT (introduced by `a620dc9`, survived two rounds): the approve-confirmation broke the pre-existing revision-approve spec

```
tests/e2e/product-moderation.spec.ts:52 › approving a healthy revision returns to the queue
  TimeoutError: page.waitForURL: Timeout 15000ms exceeded  (line 57)
```

Full-suite run on pinned `25b6f42`: **17 passed, 1 failed** — this one. Re-run **in isolation** at load average 7.5, with the other 17 green in the same run: **fails again, deterministically.** Not the environmental class.

Cause: the L2 approve-confirmation added in `a620dc9` (`pending-actions.tsx:90`) put a `window.confirm` in front of the revision approve. Playwright **auto-dismisses** dialogs by default, so the confirm returns false, `decide('approve')` never runs, and the navigation never happens. The spec has `page.once('dialog', d => d.accept())` at lines 100, 130, and 134 — but not at line 56.

This is the identical dialog-handler class dev-2 already hit and documented once in the original Phase 6 report ("Spec bug: missing `page.once('dialog', …)` — the confirm dialog auto-dismisses by default in Playwright, silently no-opping the action"). Fix: add the handler before line 56.

### My own error, stated plainly

This test appeared in the failure list of **both** of my Round 1 full-suite runs on `a620dc9`, and I attributed all of those failures to host load. That attribution was correct for the tests I actually isolated (`compares live vs proposed`, which passed alone in 46 s) but I generalized it across the whole failing set without isolating each one. One genuine, deterministic, self-inflicted failure was inside that set and I missed it for two rounds — which is precisely the reasoning error I flagged as R1a. The environmental class on this box is real, but "some failures are environmental" is not evidence that a specific failure is. Isolate per-test before attributing, including when it is my own conclusion being extended.

## R8 — MODERATE: `isConflictCode` reached only 2 of the 5 conflict-handling surfaces

M2's helper is wired into `pending-actions.tsx` and `recovery-actions.tsx`. Three surfaces still literal-match:

| Location | Code |
|---|---|
| `product-actions.tsx:64` | `if (result.code === 'version_conflict') setConflict(true)` |
| `merge-tool.tsx:73` | same |
| `product-photo-manager.tsx:39,62` | same |

Concretely reachable: two admins open the same `pending` submission and one approves first. The second gets `moderateProduct`'s 409 `conflict` ("This product is not awaiting review", `product-moderation.ts:247-253`) → `Action failed (conflict).` with no refresh affordance — the same dead end M2 was raised to remove, on a different surface. I4's pending-only gating made `conflict` the *race* signal on this surface rather than the *always* signal, which is what makes it worth closing now.

**My under-scoping, not a regression:** M2 as I wrote it named the resolve/recover routes only, so dev-2 implemented exactly what was asked. Recommend `isConflictCode` at all five call sites for consistency.

## Housekeeping

`apps/admin/playwright.config.dev2-scratch.ts` is untracked in the working tree — a leftover scratch config. Worth deleting so it doesn't get committed.

## Verification Performed (Round 3)

| Gate | Result |
|---|---|
| `pnpm --filter @expyrico/shared test` | **PASS** — 88/88 |
| `pnpm --dir apps/admin typecheck` | **PASS** |
| `pnpm --dir apps/admin lint` | **PASS** — clean |
| `pnpm --dir apps/admin test` (unit) | **PASS** — 35/35 |
| `pnpm --dir apps/admin build` | **PASS** — proxy route in manifest |
| `check-vendored-shared-dist.mjs` | **FAIL** (exit 1) — **R6** |
| e2e conflict test, pinned `25b6f42`, isolated | **PASS** (43.7 s) |
| e2e conflict test, mutation `CONFLICT_CODES = []` | **FAILS** — confirms a real guard |
| e2e full moderation suite, pinned `25b6f42` | **17 passed / 1 failed** — **R9**, deterministic in isolation |

Pinned export deleted; scratch ports 4715-4718 / 4792-4795 free; production 4000/4001 untouched. I edited no repository file — working-tree changes to `mock-*.ts` / `product-moderation.spec.ts` are dev-2's in-flight work.

## Open, in priority order

1. **R9** — add the dialog handler at spec line 56; the committed suite is red without it.
2. **R6** — resync the vendored dist (`products.*`); ping dev-3 for `system.*`.
3. **R7** — the six original new tests still pass on pre-fix code; my three A/B-proven probes remain unlanded. R1's rewrite shows the bar is achievable.
4. **R8** — `isConflictCode` at the remaining three call sites.
5. Housekeeping: delete the scratch playwright config.

---

# Round 4 Addendum — Final Pass at Tip (`3c56baa` / `8f875c6`)

Date: 2026-07-30
Scope: lead's five targeted items, verified with my own probes and A/B export standard.

**Phase 6 itself is CLEAN — R1 through R9 all closed and independently verified.**
**Two residuals remain in the shared admin e2e harness (R10, R11). Neither is Phase 6 product code, but R10 blocks the "full committed suite green" gate as stated.**

## (4) R6 — CLOSED

```
$ node scripts/check-vendored-shared-dist.mjs   → exit 0
[check-vendored-shared-dist] OK — vendored dist matches a fresh build of packages/shared.
```

## (3) R8 — CLOSED, race path probed

All five conflict surfaces now route through `isConflictCode`; no literal `=== 'version_conflict'` remains anywhere in `apps/admin/src`.

Probed the actual two-admins race rather than trusting the grep. In a pinned tip export I first aligned the mock's moderate handler to the real service's ordering (status checked *before* version, per `product-moderation.ts:247-254`) so the race yields a bare 409 `conflict` rather than `version_conflict`, then: load the pending product, have a second admin approve out-of-band via the mock API, click Approve.

```
R8: two-admins race — second admin gets 409 conflict WITH the refresh affordance
  1 passed (19.4s)
```

Both the `Refresh` button and the "This record changed since you loaded it" copy appear. Before `3c56baa` this surface literal-matched `version_conflict` and would have shown a bare `Action failed (conflict).`

## (2) R7 — CLOSED, proof method independently confirmed

Rebuilt an `a620dc9^` (pre-fix) export with its own pinned `packages/shared` — verified the isolation held (`adminProductRowSchema` has no `version` field) — and overlaid the tip spec + all mock files:

```
merged product identity › a merged_into row renders itself …            FAILED
rebase order and cap    › rebase submits exactly the reordered/capped … FAILED
2 failed
```

Both new guard tests die on pre-fix source. **dev-2's per-test pre-fix-fail proof method holds** — confirmed independently, not taken on report.

**My three Round-2 probes are subsumed, and the rebase test is stronger than mine was.** Mine asserted only client-side rendering; theirs round-trips — after rebasing it reloads the revision and asserts the *stored* photo order matches the on-screen reorder and that the capped-out 6th candidate is absent. That checks what the server actually received, which is the assertion that matters. Nothing from my probes is left uncovered.

## (1) R9 — CLOSED; `product-moderation.spec.ts` fully green

Dialog handler present before the approve click. On a pinned tip export the entire moderation spec passes; across full-suite runs every one of its tests was green.

Full committed suite on pinned tip, override ports: **24 passed / 2 failed** (`login.spec.ts`, `suspend-user.spec.ts`). Per the R9 lesson I isolated both rather than attributing:

- `login.spec.ts` — passes in isolation (3 passed, 17.7 s) once the hardcoded port is patched; flaky under full-suite load. → **R10**
- `suspend-user.spec.ts` — fails deterministically in isolation, at tip *and* at the pre-Phase-6 baseline. → **R11**

With both hardcodes patched locally: **25 passed / 1 failed**, the remaining failure being R11.

## R10 — MODERATE (test-infra): two specs still hardcode ports, so the suite is not green under override

| Location | Hardcode |
|---|---|
| `apps/admin/tests/e2e/login.spec.ts:17` | `page.waitForURL('http://localhost:4001/')` |
| `apps/admin/tests/e2e/suspend-user.spec.ts:9` | `process.env.MOCK_API_URL ?? 'http://localhost:4099'` |

The `ADMIN_E2E_PORT`/`ADMIN_E2E_MOCK_PORT` work (`878e204`) fixed `playwright.config.ts` and `admin-helpers.ts` but missed these two, which carry their own copies. `suspend-user.spec.ts` also reads a third env-var name (`MOCK_API_URL`) inconsistent with `admin-helpers.ts`'s `MOCK_API_BASE`. Observed failure: `apiRequestContext.get: connect ECONNREFUSED ::1:4099`.

Why it matters here specifically: on this box the default ports are **live production** (4000/4001), so an override run is the only safe way to execute the suite — and under override the committed suite cannot be green. Patching both locally cleared `login.spec.ts` entirely. Fix is the same one-line pattern already used in `admin-helpers.ts`.

## R11 — MODERATE (pre-existing, not Phase 6): `suspend-user.spec.ts` never passes

```
Expected: "suspended"   Received: "active"     (toPass predicate, 20s)
```

Deterministic in isolation at tip with ports patched — and **also fails on a `c6019ca^` export**, i.e. before Phase 6 existed. Not Phase 6's doing; flagging for ownership assignment, not for this phase to fix.

## (5) Bonus find reconciled — dev-2 is right, with one attribution correction

Verified the claim rather than accepting it:

| Ref | `identifier_conflict` in mock merge handler | Barcode fixtures |
|---|---|---|
| `c6019ca^` | **0 occurrences** | `DUP-0001` / `DUP-0002` — already mismatched |
| `c6019ca` | **1 occurrence** | identical, unchanged |
| `3c56baa` | 1 | both `DUP-0001` (fixed) |

So the happy path has indeed been unreachable since `c6019ca` — but **`c6019ca` introduced the guard, not the bad fixture.** The mismatched barcodes predate Phase 6 entirely and were merely harmless until the mock started enforcing the identifier check. (The real API guard landed earlier still, at `03a4ea7`, Phase 4.) dev-2's commit message says the fixture bug "has silently blocked that happy-path test since it was introduced" — accurate about the blocking, imprecise about the origin. Worth correcting in the record so nobody later hunts for a fixture change in `c6019ca` that isn't there.

### Record-integrity note (same class as R1a — noting, not relitigating)

The original Phase 6 report recorded "E2E: **13/13 pass**". That count cannot have included a passing `merge-product` happy path, and `suspend-user` (R11) was also failing throughout. Any full-suite green total in the Phase 6 reports therefore overstated what was actually green. The lesson is the one already established twice in this thread: a suite-level pass count is only as good as the per-spec statuses behind it, and per-spec status is what should be recorded.

## Verification Performed (Round 4)

| Check | Result |
|---|---|
| `check-vendored-shared-dist.mjs` at tip | **exit 0** |
| `isConflictCode` at all 5 surfaces; no literals left | **confirmed by grep** |
| R8 two-admins race probe (mock aligned to real check ordering) | **PASS** |
| New guard tests overlaid on pinned `a620dc9^` | **both FAIL** — proof method holds |
| `product-moderation.spec.ts` at pinned tip | **all green** |
| Full committed suite, pinned tip, override ports | 24 passed / 2 failed → **R10**, **R11** |
| Same, with R10's two hardcodes patched | 25 passed / 1 failed (**R11** only) |
| `login.spec.ts` isolated, port patched | **3 passed** |
| `suspend-user.spec.ts` isolated at tip | **FAIL** |
| `suspend-user.spec.ts` isolated at `c6019ca^` | **FAIL** → pre-existing |
| `merge-product` fixture/guard archaeology | guard added at `c6019ca`; fixture predates it |

All exports deleted; scratch ports 4721-4731 / 4781-4791 free; production 4000/4001 never touched; no repository file edited by me.

## Verdict

**Phase 6 — CLEAN.** R1-R9 closed, every closure independently verified against running code, and the two new guard tests meet the pre-fix-fail bar.

**Not clean at the suite level:** R10 keeps the committed suite from going green under the only port configuration that is safe to run here, and R11 is a pre-existing never-passing spec. Both are shared admin e2e harness, outside Phase 6's ownership — the lead's call whether they gate Phase 8 or get their own owner.
