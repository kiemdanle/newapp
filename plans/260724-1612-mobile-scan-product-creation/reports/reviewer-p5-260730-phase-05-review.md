# Phase 5 review — mobile scan and draft editor (reviewer-p5)

- Branch: `feature/mobile-scan-product-creation`, HEAD `6aa8774`
- Review surface: `git diff ac2a486..HEAD -- apps/mobile` (86 files, +8731/-301), plus
  `patches/@google-cloud__recaptcha-enterprise-react-native@18.9.2.patch`, root
  `package.json` `pnpm.patchedDependencies`, `apps/mobile/local-packages` vendored dist.
- Author: dev-1 (Tasks 1–9). Task 2's files landed as riders inside `47a671e` — reviewed
  cumulatively, not per-commit.
- Not re-flagged per assignment: task #46 snapshot drift (6 failures), task #47 lint debt
  (12 errors outside this phase), dev-2's live `apps/admin` working-tree changes.

## Verdict

**0 CRITICAL, 2 IMPORTANT, 7 MODERATE, 3 LOW.**

No trust-boundary defect found. Every binding plan constraint I was asked to check holds:
bearer tokens never appear in a URL or a log, private media is header-authorized and
account-scoped with a real purge, `under_review` reveals nothing, `not_found`'s Create CTA
is gated on the server's `canCreate`, thrown lookup errors can never reach creation,
pending-attach-only holds on both continuation paths, and the pnpm patch does exactly the
two documented things. The defects are concentrated in the mutation coordinator's conflict
window and in the photo editor's handling of a conflicted coordinator — both are silent
(no error surfaced to the user) rather than loud.

---

## IMPORTANT

### I1 — a photo mutation enqueued during an unresolved conflict reports success, uploads nothing, and deletes the user's temp file

Evidence:
- `apps/mobile/src/features/products/draft-mutation-coordinator.ts:251-257` — the
  non-metadata branch runs `await doMetadataFlush()`, then `if (conflict) return known;`.
  It resolves with the last-known entity **without calling the adapter at all**.
- `apps/mobile/src/features/products/ProductPhotoEditor.tsx:99-104` — the caller treats any
  resolution as success: `updateEntry(..., { status: 'uploaded', ... })` then
  `await cleanupTemp([entry.path])`.
- `apps/mobile/src/features/products/DraftEditor.tsx:70-74` and `EditEditor.tsx:50-54` —
  `ProductPhotoEditor` is mounted unconditionally; nothing disables the Take photo /
  Choose photos / Remove / reorder controls while `coordinator.hasConflict()` is true, and
  the component never reads `hasConflict()`.

Reproduced (scratch jest run, since deleted): with the coordinator in a conflict state,
`enqueue({kind:'upload'})` resolved, `adapter.uploadPhoto` was called **0 times**, and the
promise did not reject.

Impact: while the conflict banner is on screen, a user who adds a photo sees it marked
uploaded, the picker temp file is deleted, and the photo does not exist server-side. Same
silent no-op for `delete` and `order` (the grid "refreshes" to the unchanged state). This
is exactly the "phantom success after cancellation" failure mode Task 2 was written to
avoid, reintroduced one layer up.

Recommendation: make the conflict branch reject with a typed error
(`{ code: 'coordinator_conflict' }`) instead of resolving with `known`, so the existing
`.catch` in `startUpload` marks the entry `failed` and keeps the temp file; and gate the
photo controls on `coordinator.hasConflict()` in `ProductPhotoEditor` the way
`DraftSubmitPanel` already gates submit.

### I2 — `reconcileConflict('retry')` re-sends a stale snapshot, discarding every edit typed during the conflict window

Evidence: `draft-mutation-coordinator.ts:300` — `pendingFields = resolved.pendingFields;`
overwrites the live `pendingFields` map with the snapshot captured at
`draft-mutation-coordinator.ts:203` (`notifyConflict({ ..., pendingFields: fields })`).
Edits merged in at `draft-mutation-coordinator.ts:239` during the conflict window are
dropped on the floor.

Reproduced: conflict on `{name:'A'}`, user then types `A-newer`, `reconcileConflict('retry')`
issued `patchMetadata('p1', 5, { name: 'A' })` — the newer value was lost with no error.

Two secondary consequences of the same line:
- The `ConflictInfo.pendingFields` object handed to every `onConflict` listener is then
  mutated in place by the success-path key deletion at
  `draft-mutation-coordinator.ts:191-193` (it is now the *same object* as `pendingFields`,
  not a copy). The reference-aliasing defence documented at
  `draft-mutation-coordinator.ts:170-181` is defeated on this one path — I observed the
  recorded call argument for the conflicted attempt mutate to `{}` after the retry
  succeeded.
- `plan.md`'s "dirty fields are reconciled after conflict/refetch" and the phase file's
  "reapplies dirty fields after refetch" are only satisfied for fields typed *before* the
  conflict.

Recommendation: merge rather than overwrite —
`pendingFields = { ...resolved.pendingFields, ...pendingFields };` — and deep-copy
`fields` into `ConflictInfo` so the snapshot handed to listeners stays immutable.

---

## MODERATE

### M1 — a metadata enqueue issued while a flush is in flight is silently dropped if that flush conflicts

`draft-mutation-coordinator.ts:204` — `pendingWaiters = waiters;` **replaces** the array,
discarding any waiter pushed at `:241` while `adapter.patchMetadata` was awaiting. That
caller's `enqueue()` promise never settles.

Reproduced: second `enqueue` never resolved or rejected, even after
`reconcileConflict('discard-local')`.

Currently latent in the shipped screens (the only metadata producer is the Save button,
which `Button.tsx:46` disables while `loading`). It becomes live the moment debounced
autosave is wired — see M2. Fix: `pendingWaiters = [...waiters, ...pendingWaiters];`.

### M2 — the specified debounced metadata autosave was never implemented

Phase file Task 5 ("metadata debounce marks dirty but executes in queue") and Task 8
("metadata autosave") describe a debounce the code does not contain — `grep -rn
"autosave\|debounce" apps/mobile/src/features/products/` returns nothing. Both forms ship
an explicit Save button (`ProductDraftForm.tsx:226-234`, `ProductEditForm.tsx`). The
coordinator's coalescing machinery (`draft-mutation-coordinator.ts:227-234`) exists for a
producer that was never built.

This is a defensible simplification, but the phase file's Task 5/8 checkboxes claim the
debounce. Recommendation: either implement it (after M1 is fixed — the two interact
directly) or amend the phase file to record the deviation explicitly.

### M3 — a successfully-uploaded photo leaves a stale duplicate tile whose file has been deleted

`ProductPhotoEditor.tsx:263` renders every `localQueue` entry, and nothing removes an entry
once `status === 'uploaded'`. The same photo therefore renders twice — once as the
authoritative server thumbnail (`:198`), once as the local entry whose
`source={{uri: entry.path}}` (`:265-269`) points at a file `cleanupTemp` deleted at `:102`.
The count math at `:67-69` is correct; only the render is wrong. No test covers post-upload
grid contents (`ProductPhotoEditor.test.tsx:102` stops at the "uploaded" status and the
cleanup call).

Recommendation: filter `localQueue` on `uploadedPhotoId === null` in the render, or drop the
entry in the `.then`.

### M4 — `movePhoto` computes the reorder against the unsorted array while the grid renders the sorted one

`ProductPhotoEditor.tsx:176` uses `serverPhotos.map(...)`; the grid renders
`orderedServerPhotos` (`:188`, sorted by `position`). If the two ever differ, the index the
user sees is not the index that gets swapped and the full desired order sent to the server
is wrong.

Latent today — the API always returns photos ordered
(`api/src/services/products/product-visibility.ts:18` and
`product-photos.ts:125,296,524,625` all use `orderBy: { position: 'asc' }`). But the
component's own defensive sort implies it doesn't trust that, and then doesn't apply it
where it matters. Use `orderedServerPhotos` in `movePhoto`.

### M5 — `removeServerPhoto` / `movePhoto` have no rejection handling

`ProductPhotoEditor.tsx:166-186` — both are `async` and invoked bare from `onPress`
(`:231`, `:239`, `:255`). A failed delete/reorder produces an unhandled promise rejection
and **no user-visible feedback at all**; the grid simply doesn't change. Compare the upload
path, which does have a `.catch` (`:105-107`). Add a catch that surfaces the failure the
way `pickerError` already does.

### M6 — the submit retry keeps the idempotency key only for `503 temporarily_unavailable`, not for every 5xx

`DraftSubmitPanel.tsx:63` narrows to `err.status === 503 && err.code === 'temporarily_unavailable'`;
every other outcome nulls the key at `:69`.

I verified the plugin: `api/src/plugins/idempotency.ts:229-233` deletes the reservation on
**any** `statusCode >= 500`, and caches with a request hash otherwise. So the client's
"new key on 4xx/2xx" branch is correct and safe, and the same-key 503 branch is correct.
But a 500/502/504 — or a transport error with no response, which isn't an `ApiError` at all
— also mints a fresh key, forfeiting replay protection precisely in the case where the
server may have committed the submit before failing to respond. The draft state guard turns
that into a confusing secondary error rather than a duplicate submission, so this is a UX
and contract-fidelity issue, not data loss.

Recommendation: retain the key for `err.status >= 500` and for network-level failures;
mint fresh only on a definite 2xx/4xx.

### M7 — an unrecognized `outcome` leaves the scanner permanently stuck on "Looking up item…"

`scan.tsx:60-91` switches over the six outcomes with no `default`, and
`products.ts:22` casts the response (`apiClient.post<ProductLookupV2Response>`) without
parsing it. A server that ever adds a seventh outcome falls through the switch, `ui` stays
`{phase:'looking-up'}`, `ScanCamera` stays unmounted, and the only escape is the back
button. All six current outcomes are confirmed present in
`packages/shared/src/schemas/product.ts:170-195`, so this is forward-compatibility, not a
live bug. Add `default: setUi({ phase: 'unavailable' })` — it costs one line and matches the
file's own stated invariant that anything non-conclusive is `unavailable`.

### M8 — `useFocusEffect` is called with a non-memoized callback, and the test mock hides it

`app/(app)/product/new.tsx:55` and `app/(app)/product/[id]/edit.tsx:48` pass an inline arrow
to `useFocusEffect`, which React Navigation requires to be `useCallback`-wrapped; as written
the `beforeRemove` listener is torn down and re-registered on every render.

The test setup can't catch this: `apps/mobile/tests/setup.ts` replaces `useFocusEffect` with
`(effect) => useEffect(effect, [])`, which runs once regardless. Wrap both callbacks in
`useCallback`, and consider making the mock honour the callback identity so the divergence
can't recur.

---

## LOW

### L1 — `Retry` on the unavailable panel doesn't consult the in-flight guard

`scan.tsx:127-134` calls `runLookup` without checking `lookupInFlightRef.current` (unlike
`handleScan` at `:110`). Two taps inside one React batch would issue two lookups. Harmless
(idempotent GET-equivalent), but the guard already exists — use it.

### L2 — `DraftSubmitPanel.submit` has no synchronous re-entrancy guard

`DraftSubmitPanel.tsx:39` relies on the `busy` state reaching `Button` (`:92`) before a
second press. A double-tap inside one batch would send two submits sharing one key with two
different abuse tokens; the second gets `idempotency_in_progress`. No duplicate submission,
just a confusing message. A `useRef` guard mirrors what `scan.tsx` already does.

### L3 — an oversized picker result leaks its temp file

`photo-picker-adapter.ts:54` throws `PhotoTooLargeError` before the caller ever learns the
path, so `cleanupTemp` is never called for it. Call `cleanupTemp([image.path])` before
throwing.

---

## Constraint verification (all PASS)

| Binding constraint | Verified at |
|---|---|
| Scanner never routes errors/outages into creation | `scan.tsx:88-96`; mutation-tested (below) |
| `not_found` Create gated on response `canCreate` | `scan.tsx:83-86`, `:249-253`; schema `product.ts:191` |
| `under_review` reveals nothing, custom item only, `productId={null}` | `scan.tsx:201-244`; schema `product.ts:188` is `.strict()` with no payload |
| Debounce/in-flight guard uses a ref, not state | `scan.tsx:46,54,98,110` — the ref-vs-state fix is real and correct |
| Serialized product-mutation queue | `draft-mutation-coordinator.ts:141,215-225`; mutation-tested |
| No unhandled rejection on the internal chain | `draft-mutation-coordinator.ts:220-223` — correct |
| Bearer token never in a URL | `product-private-image.tsx:83`, `product-photo-upload.ts:104`, `client.ts:116`; `grep "token="` across `src/api` + `src/features/products` returns nothing |
| No token/PII logging | no `console.*` anywhere in the Phase 5 source |
| Private media → `data:` URI, native loader never sees the real URL | `product-private-image.tsx:98,160` |
| Account-scoped cache + purge on sign-in / sign-out / 401 / 403 | `product-private-image.tsx:29-31,43-45,89-92`; `session-store.ts` signIn+signOut |
| Retained edit photo uses the public URL, never the private route | `ProductPhotoEditor.tsx:200-210` |
| Pending-attach-only; `lockedPersonalScope` on both continuations | `product/new.tsx:112-156` (fresh submit + retrofitted `resume=pending`); `AddRecordForm.tsx` forces `effectiveHouseholdId = null` and hides the picker |
| No submit affordance outside the abuse-verified panel | `DraftSubmitPanel` is the only submit path for a draft |
| Same key on 5xx / new key on 4xx | `DraftSubmitPanel.tsx:51,63-69` vs `api/src/plugins/idempotency.ts:229-240` — correct, with the M6 narrowing |
| Submit blocked while the photo queue is unsettled | `DraftEditor.tsx:75` ← `ProductPhotoEditor.tsx:70,74-77` |
| Edit flow carries no abuse token; `edit_base_stale` terminal | `product-edits.ts:56-67`; `EditSubmitPanel.tsx:53-56,71` (button removed entirely) |
| `mode=off` never blocks active revisions | `product/[id]/edit.tsx` and `product-edits.ts` never read the flag |
| Draft index user-namespaced + purged on sign-out | `product-draft-storage.ts:31-33,86-89`; `session-store.ts` signOut |
| HEIC forced to JPEG in the picker | `photo-picker-adapter.ts:69` (`forceJpg: true`) — note this option is iOS-only upstream; Android relies on the uCrop JPEG output implied by `cropping: true`. Worth one line in the evidence doc |
| pnpm patch scope | exactly two hunks: `apply plugin: "org.jetbrains.kotlin.android"` + `recaptcha:18.9.2 → 18.8.0`. Drop condition documented in the checklist/evidence docs |
| Native deps isolated behind adapters | `photo-picker-adapter.ts`, `product-creation-assessment.ts` — no direct third-party import anywhere else |

---

## Gates (N/M, pinned)

| Gate | Result |
|---|---|
| `pnpm --dir apps/mobile typecheck` | **PASS** (exit 0) |
| `pnpm --dir apps/mobile test` (full) | **289/295**, 58/61 suites — the 6 failures are task #46's snapshot drift in `home`/`sign-in`/`welcome`. Matches dev-1's claim exactly |
| Phase 5 scoped jest (`__tests__/routes src/features/products src/api src/security`) | **165/165**, 27/27 suites — fully attributable, unaffected by #46 |
| Scoped lint (`app/(app)/scan.tsx`, `app/(app)/product`, `src/features/products`, `src/api`, `src/security`, `session-store.ts`, `AppNavigator.tsx`, `AddRecordForm.tsx`) | **0 problems** |
| `node scripts/check-vendored-shared-dist.mjs` | **PASS** — vendored dist matches a fresh `packages/shared` build |
| Android `:app:assembleDebug` | **not re-run** (per instruction). Evidence verified in `reports/phase-05-native-verification-checklist.md`: real 82 MB APK, `-PreactNativeArchitectures=arm64-v8a`, resource accommodation disclosed. iOS truthfully reported as not attempted (Linux host) |

Note: `.eslintrc.cjs:26` ignores `__tests__/`, so the four new route test files
(`__tests__/routes/*.test.tsx`) are not linted, while `src/**/*.test.ts` files are. Pre-existing
config, but Phase 5 added the largest test files yet under the exempt path.

### Mutation testing (3/3 killed — tests are guards, not coverage)

| Mutation | Result |
|---|---|
| `scan.tsx` catch → `setUi({phase:'not-found', canCreate:true})` | **KILLED** — `scan.test.tsx:148` "a thrown network error is treated as unavailable, never as not-found" failed |
| `DraftSubmitPanel.tsx` key reuse → always `newIdempotencyKey()` | **KILLED** — `DraftSubmitPanel.test.tsx:107` 503 same-key/fresh-token test failed at `:128` |
| `draft-mutation-coordinator.ts` `run()` → `fn()` (no chaining) | **KILLED** — 5 of 10 coordinator tests failed |

All source files restored (`git diff --stat` clean for each); scratch test file deleted.

---

## Recommended actions, in order

1. I1 — reject instead of resolving on the conflicted non-metadata branch; gate photo
   controls on `hasConflict()`.
2. I2 — merge, don't overwrite, in `reconcileConflict('retry')`; copy `ConflictInfo.pendingFields`.
3. M1 — prepend restored waiters instead of replacing the array (do this together with I2;
   both are in the same conflict path).
4. M3, M5 — photo grid: drop uploaded local entries, surface delete/reorder failures.
5. M6, M7, M8, M4 — small, independent.
6. M2 — decide: implement the debounce, or amend the phase file's Task 5/8 wording.
7. L1–L3 at leisure.

## Plan status

Tasks 1 and 3–9 are substantively complete as described. Task 5's "metadata debounce"
sub-bullet and Task 8's "metadata autosave" are not implemented (M2) — those two checkboxes
overstate. Task 1's iOS step remains correctly unchecked with a truthful reason. I did not
edit any plan file.

## Unresolved questions

1. Is the explicit-Save-button UX (instead of the specified debounced autosave) an accepted
   product decision, or a gap? The answer changes M1's severity from latent to live.
2. `forceJpg` is documented upstream as iOS-only. Was Android HEIF input actually exercised
   on the Task 9 device run, or is the JPEG guarantee there resting on uCrop's default
   output format?
