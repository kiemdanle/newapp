# Phase 5 remediation re-verification — commit 8cf0d5e (reviewer-p5)

Round 2 of `reviewer-p5-260730-phase-05-review.md`. Remediation commit `8cf0d5e`
("fix(mobile): close reviewer-p5's conflict-window gaps in the mutation coordinator"),
verified at repo HEAD `8cf0d5e` with a clean `apps/mobile` working tree.

## Verdict: **CLEAN**

All 12 findings resolved. The newly-found third bug in the same family is fixed and
independently verified. All 7 new tests are proven guards by mutation. The 302/302 gate
claim reconciles exactly on a pinned export. No new findings, no regressions.

---

## 1. Original findings re-verified with my own repros

I re-ran my three original round-1 repros with inverted expectations, plus three more I
wrote for this round — deliberately my own fixtures, not dev-1's tests, so the fixes are
verified independently of the tests written to satisfy them. All 6 pass:

| # | Repro | Result |
|---|---|---|
| I1 | upload enqueued during unresolved conflict | **rejects** with `code: 'coordinator_conflict'`; `uploadPhoto` never called |
| I1b | delete and order during conflict | both reject the same way; `deletePhoto`/`orderPhotos` never called |
| I2 | `reconcileConflict('retry')` after typing during the conflict window | re-sends `{ name: 'A-newer' }` — the newer edit now wins (was `{ name: 'A' }`) |
| I2b | `ConflictInfo.pendingFields` after a later successful retry | snapshot still `{ name: 'A' }` — no retroactive mutation (was `{}`) |
| M1 | metadata enqueue while a conflicting flush is in flight | settles (was: never settled) |
| NEW | metadata enqueue during an *open* conflict | stays pending, then settles with the retry outcome `v6` — not the stale pre-conflict state |

Temp-file retention on the I1 path confirmed by reading `startUpload`'s `.catch`
(`ProductPhotoEditor.tsx`): it marks the entry `failed` and does **not** call
`cleanupTemp`, so a conflict-rejected upload keeps its local file and stays retryable.
That was the actual data-loss mechanism in round 1 and it is now closed at both ends —
the coordinator refuses to fake success, and the editor refuses to attempt it.

## 2. The third family member (new surface, verified independently)

`doMetadataFlush`'s top-of-function conflict short-circuit previously drained
`pendingWaiters` and resolved them with the stale pre-conflict `known`. Now it leaves
`pendingWaiters` untouched and returns `applyDirty(known, pendingFields)` as a
best-known snapshot for direct `flushMetadata()` callers only.

I verified this independently of dev-1's fixture with the `NEW` repro above: a second
`enqueue` arriving during an open conflict must **not** settle early, and must ultimately
settle with `v6` (the real retry outcome). Both assertions hold.

I also confirmed the fix doesn't strand waiters: `reconcileConflict('discard-local')`
drains and resolves them explicitly, and `reconcileConflict('retry')` settles them through
its own `doMetadataFlush` once `conflict` is cleared. Both paths exercised.

dev-1's own `M1` test is a genuine guard for this too — it asserts *both* callers resolve
`toMatchObject({ version: 6 })`, pinning the value rather than mere settlement, which is
why it catches the early-return regression and not just the waiter-drop one.

## 3. Mutation testing — 7/7 new tests killed

The lead's central ask, since a coverage gap of exactly this class is why I1/I2/M1
survived round 1. Each fix was reverted individually; the corresponding test must fail.

| Mutation (fix reverted) | Test killed |
|---|---|
| I1: `throw ApiError(coordinator_conflict)` → `return known` | `I1: a non-metadata operation … rejects and never reaches the adapter` |
| I2: `{...resolved.pendingFields, ...pendingFields}` → `resolved.pendingFields` | **2 tests** — the merge test *and* the listener-aliasing test |
| M1: `[...waiters, ...pendingWaiters]` → `waiters` | `M1: … still settles once that flush conflicts` (hung to 5001 ms timeout) |
| Early-return: restore drain-and-resolve-with-stale-`known` | `M1: … still settles` (settled with stale state) |
| Editor I1: `blockedByConflict = coordinator.hasConflict()` → `false` | `I1: every photo control is disabled while … unresolved conflict` |
| Editor M5: remove `removeServerPhoto` try/catch | `M5: a failed delete surfaces a visible error` |
| Editor M5: remove `movePhoto` try/catch | `M5: a failed reorder surfaces a visible error` |

7 mutations, 8 test failures, zero survivors. These are guards, not coverage. All source
files restored after each mutation (`git diff --stat` clean).

## 4. HEIF/HEIC citation verified against the pinned source

dev-1's answer to my round-1 Q2 is **accurate**, checked against the real
`react-native-image-crop-picker@0.51.1` on disk
(`node_modules/react-native-image-crop-picker/android/src/main/java/com/reactnative/ivpusic/imagepicker/Compression.java`,
`package.json` version confirmed `0.51.1`):

- `:117` — `knownMimes = ["image/jpeg","image/jpg","image/png","image/gif","image/tiff"]`. HEIC/HEIF is **not** in the list.
- `:113` — `isLossLess = (quality == null || quality == 1.0)`.
- `:120` — the skip path requires `isLossLess && useOriginalWidth && useOriginalHeight && isKnownMimeType` — a four-way AND.
- `:134` → `resize(...)` → `:70` — `bitmap.compress(Bitmap.CompressFormat.JPEG, quality, os)`, hardcoded, no format branch.

Our `compressImageQuality: 0.82` makes `isLossLess` false unconditionally, so the skip path
is unreachable regardless of input format. The claim is if anything *conservative*: quality
alone forecloses passthrough before the mime allowlist matters. Both cited conditions are
real and the conclusion holds. Correctly documented in the adapter comments and the native
checklist, and correctly flagged that `forceJpg` is iOS-only with no Android effect.

## 5. Gates (pinned export)

Per harness rules: `git archive 8cf0d5e | tar -x` into `/tmp/p5-verify-export` (no
worktree), `packages/shared` rebuilt inside the export, no prod ports, export deleted and
strays confirmed none afterwards.

| Gate | Result |
|---|---|
| Full `jest` on the pinned export | **302/302, 61/61 suites, 16/16 snapshots** |
| Reconciliation vs claim | exact: 295 prior + 7 new = 302. Prior 6 snapshot failures now pass (task #46 landed) |
| `tsc --noEmit` on the export | **PASS** |
| Scoped lint on the export (`scan.tsx`, `app/product`, `features/products`, `api`, `security`) | **0 problems** |

The "Jest did not exit" warning persists — pre-existing, isolated in round 1 to `src/tests`,
not Phase 5.

## 6. Remaining MODERATE/LOW fixes spot-checked

- **M3** — `visibleLocalQueue` filters confirmed-uploaded entries out of render. Correct.
- **M4** — `movePhoto` now maps `orderedServerPhotos`; `useCallback` dep updated to match.
- **M5** — both handlers catch and surface via the existing `pickerError` text.
- **M6** — `keepsKey = !isApiError(err) || err.status >= 500`. This is exactly right against
  `api/src/plugins/idempotency.ts:229-233` (deletes the reservation on any `>= 500`, caches
  with a request hash otherwise); a transport failure that never got a response can't have
  cached anything under that key either. `abuse_check_failed` (403) correctly falls through
  to the fresh-key branch.
- **M7** — `default: setUi({ phase: 'unavailable' })` added to the outcome switch.
- **M8** — both `useFocusEffect` callbacks wrapped in `useCallback`.
- **L1** — `retry` now consults `lookupInFlightRef`.
- **L2** — `submitInFlightRef` guard mirrors `scan.tsx`.
- **L3** — `toPickedPhoto` is now async and cleans up before throwing; `choosePhotos`
  correctly awaits `Promise.all`.
- **M2** — recorded in the phase file as an accepted deviation citing the lead's ruling,
  on both the Task 5 and Task 8 lines, rather than leaving the checkboxes overstating.
  This is the honest resolution.

## 7. Residual observation (not a finding, no action requested)

In `choosePhotos`, a multi-select where **one** photo exceeds the advisory limit rejects the
whole `Promise.all`; the oversized file cleans itself up, but its already-validated siblings
are discarded without a `cleanupTemp`. This is strictly better than the pre-L3 behaviour
(where every file including the oversized one leaked) and the OS reclaims picker temp files
anyway. Noting it only so it isn't rediscovered as new later.

## Answers to my round-1 open questions

1. **Debounced autosave** — ruled an accepted deviation by team-lead; documented in the
   phase file. This resolves M2 and permanently retires the "M1 becomes live if autosave is
   wired" risk, since M1 is fixed regardless.
2. **Android HEIF** — answered empirically from pinned source, verified above. Closed.

## Status

Phase 5 is clean from my side. No blocking items remain against `8cf0d5e`.
