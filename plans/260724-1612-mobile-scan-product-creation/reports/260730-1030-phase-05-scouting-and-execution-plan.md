# Phase 5 scouting and execution plan

Owner: dev-1. Read-only scouting done during standby, per team-lead's directive.
Implementation stays gated on Phase 7 completion + this plan's approval — no
mobile code touched yet. Builds on `phase-05-mobile-scan-and-draft-editor.md`
(the approved spec) by resolving concrete API contracts, current-code deltas,
and execution ordering against what's actually in the repo today.

## What's already usable, unmodified

- **Lookup v2 contract** is live: `POST /v1/products/lookup-v2` (auth required),
  discriminated union `productLookupV2ResponseSchema` in
  `packages/shared/src/schemas/product.ts` — `found | editable_private |
  creator_pending | under_review | not_found{canCreate} |
  temporarily_unavailable{retryAfterSeconds?}`. Current mobile `scan.tsx` still
  calls the old `/products/lookup` (v1) and treats *any* thrown error,
  including network/5xx, as "not found" → routes straight into
  `ProductNew`. That is exactly the defect Phase 5's Task 3 and the plan's
  global constraint ("scanner never routes arbitrary errors/outages into
  creation") must close — not a hypothetical, it's live in the diff I'll be
  writing against.
- **Draft routes** (prefix `/v1/products`, registered in
  `api/src/routes/products/index.ts`): `POST /drafts` (idempotent,
  create-or-resume, `{barcode|qrPayload}` exactly one) → `{product, resumed}`;
  `GET /drafts?...` → cursor page (`productDraftsQuerySchema`/`PageSchema`);
  `PATCH /drafts/:id` (version-guarded, name/description/brand/category) →
  product; `POST /drafts/:id/submit` (idempotent) →
  `{version, abuseToken, platform:'android'|'ios'}` → product. Draft photo
  mutations reuse the *product* photo routes (`POST/DELETE
  /:productId/photos`, `PATCH /:productId/photos/order`, `GET
  /:productId/photos/:photoId/:variant` for private bytes) — there is no
  separate `/drafts/:id/photos` namespace; the product ID *is* the draft ID
  pre-approval.
- **Active-revision routes** live in a **separate namespace**,
  `/v1/product-edits`, registered directly in `api/src/server.ts` (not
  `api/src/routes/products/index.ts` — I checked both files since the
  edit-*.ts route files exist under `routes/products/` but only
  `edit-create.ts` is wired there; the rest are mounted with an explicit
  prefix in `server.ts`). Full map: `POST /v1/products/:id/edit` (idempotent,
  create-or-resume on an *active* product, returns the edit — this call is
  also the "detail/refresh" fetch, since it's idempotent and always returns
  current state; there is no separate `GET /v1/product-edits/:editId`) →
  then `PATCH /v1/product-edits/:editId` (metadata, version-guarded), `POST
  /v1/product-edits/:editId/photos` (staged upload), `DELETE
  /v1/product-edits/:editId/photos/:photoId`, `PATCH
  /v1/product-edits/:editId/photos/order`, `GET
  /v1/product-edits/:editId/photos/:photoId/:variant` (staged private bytes),
  `POST /v1/product-edits/:editId/submit` (idempotent). This resolves the
  spec's "detail" method in `Produced Interfaces` — it's the create/resume
  call, not a new GET.
- **Submit contract is frozen and shipped** (dev-3, `7561dcf`): request body
  is exactly `{version, abuseToken, platform}`, strict schema, no extra
  fields. Failure surface: `403 feature_disabled` (mode gate),
  `403 abuse_check_failed` (assessment rejected/low score), `503
  temporarily_unavailable` (provider timeout — nothing written, safe to retry
  same Idempotency-Key), `409 version_conflict` (stale). Mobile's coordinator
  must treat 503 as retry-same-key, not a new draft state.
- RN host is already bare RN 0.76.9 New Architecture, React Navigation 7,
  TanStack Query 5, Zustand session store, `react-native-vision-camera`
  4.7.2 (scan), `@react-native-ml-kit/text-recognition` (OCR),
  `react-native-keychain` (secure token store), `react-native-config` (env).
  **Not present yet**: `react-native-image-crop-picker` (Task 1 native proof
  required before anything else touches the editor), any reCAPTCHA
  Enterprise SDK, any multipart/FormData/PUT support in `api/client.ts`
  (current `doFetch` is JSON-only — `POST/GET/PATCH/DELETE`, no `PUT`, no
  progress/cancel/abort, single-flight refresh-then-retry already correct
  and worth preserving as-is).
- `apps/mobile/.env` / `.env.example` have no `RECAPTCHA_*` keys yet (the API
  side already has `RECAPTCHA_PROJECT_ID` / `RECAPTCHA_SITE_KEY_ANDROID` /
  `RECAPTCHA_SITE_KEY_IOS` in `api/.env.test`). Task 1 must add the two site
  keys (Android/iOS are different registered keys per the shared-schema
  comment) to mobile env plumbing via `react-native-config`.
- Vendored shared/theme copies live at
  `apps/mobile/local-packages/@expyrico/{shared,theme}/dist`, `file:` deps —
  confirms the task #5 handoff note: any `packages/shared` schema change
  (there will be several as Phase 5 wires lookup-v2/drafts/edits) requires
  rebuilding `packages/shared` then refreshing both vendored copies before
  mobile tests/typecheck, or mobile will silently compile against stale
  types.

## Current code this phase replaces (not extends)

- `app/(app)/product/new.tsx` and `app/(app)/product/[id].tsx` both call
  `useCreateProduct()` → legacy `POST /v1/products`, which the plan's global
  constraints say is permanently blocked with `upgrade_required` after this
  deployment. These two screens' creation paths are dead code walking, not a
  base to extend — Phase 5 replaces `new.tsx`'s body with the draft flow and
  adds the **Suggest an edit** entry + `product/[id]/edit.tsx` alongside
  `[id].tsx`'s existing OCR/AddRecordForm usage, which stays for the
  already-active-product personal-pantry path.
- `AddRecordForm` today has no `lockedPersonalScope` prop and always renders
  the household picker when `households.length > 0`; `effectiveHouseholdId`
  falls back to the active scope. Task 7's addition is a pure prop-gated
  branch above that fallback — low risk, but note `households.length > 0`
  must also respect the lock (hide the picker entirely, not just disable
  selection, per spec wording).
- The Android/iOS reliability plan (`2026-07-22-android-scan-passkey-*`,
  recovered from git history — the working-tree copy under
  `docs/superpowers/{plans,specs}/` is currently deleted uncommitted,
  unrelated to this work, left untouched) already fixed adjacent surfaces
  Phase 5 touches: `usePermission.ts`'s 4-state camera permission mapping,
  `OcrCamera.tsx`'s `file://` URI normalization, and `AddRecordForm`'s
  `initialExpiry`/duplicate-confirmation additions. Phase 5 must build on
  those, not re-diverge them — e.g. photo capture in the new
  `ProductPhotoEditor` should reuse `usePermission`'s state machine rather
  than inventing a second one.

## Resolved open questions

1. **"Detail" interface for active-revision editor** = the idempotent
   create/resume call (`POST /v1/products/:id/edit`), re-invoked on mount and
   after conflict-refetch. No new endpoint needed; the phase file's
   `Produced Interfaces` block doesn't actually name a `detail` method
   (re-read it — only `enqueue/flushMetadata/reconcileConflict` on the
   coordinator, and `uploadProductPhoto`), so no contract gap here at all,
   just confirming resume doubles as refresh.
2. **Draft photo endpoints reuse product routes** — mobile's
   `product-photo-upload.ts` transport must be parameterizable by target
   (`{kind:'draft', productId}` vs `{kind:'product_edit', editId}`) since the
   URL shapes differ (`/products/:id/photos*` vs
   `/product-edits/:editId/photos*`) but the multipart/progress/cancel
   mechanics are identical — one transport, one small path-builder switched
   on `target.kind`, matching the spec's explicit target-tagged design for
   the mutation coordinator.
3. **Scan routing bug is real, not spec-only** — confirmed by reading
   `scan.tsx`'s `catch` block. Task 3 fixes this as its primary job, not a
   nice-to-have.

## Execution ordering (risk-first, per plan.md's own mitigation table)

Sequencing follows the phase file's Task 1–9 breakdown as-is (it's already
risk-ordered — native proof first, transport second, lookup third, editor
fourth+) with these concrete gates added:

1. **Task 1 (native proof) blocks everything else that imports the picker or
   reCAPTCHA SDK.** Android debug compile + iOS pod-install/compile attempt
   must both run and their real results (pass/fail/environment-unavailable)
   get reported truthfully before Task 6 (photo UX) or Task 1's own
   `executeProductSubmitAssessment` adapter get consumed anywhere else. If
   `react-native-image-crop-picker` fails the RN 0.76.9 New Architecture
   proof, stop and bring back verified alternatives per plan.md's unresolved-
   questions clause — do not silently mock past it.
2. **Task 2 (transport) has no native dependency** — can run in parallel with
   Task 1 if useful, since `client.ts`'s FormData/PUT/progress/cancel/private-
   image-auth work only touches `src/api/` and doesn't need the picker.
   I'll still do it second in practice (after confirming native proof
   doesn't force a transport-shape change, e.g. crop-picker's own upload
   helpers), but noting the file-ownership independence in case team-lead
   wants to parallelize with another agent later.
3. **Tasks 3–4 (lookup state machine, resumable editor)** depend on Task 2's
   transport and are where the `scan.tsx` routing bug gets fixed — this is
   the first user-visible correctness change and worth its own gate/commit
   per the phase file's existing plan.
4. **Task 5 (mutation coordinator)** is the highest-risk item per plan.md's
   risk table ("Lost local intent" — Medium/High) — build and test it against
   deterministic out-of-order-resolution fixtures *before* wiring real photo
   UX to it (Task 6), so coordinator bugs aren't masked by UI timing.
5. **Tasks 6–7 (photo UX, submit)** consume the now-proven native picker and
   coordinator.
6. **Task 8 (active-revision editor)** reuses everything from 2–6 against the
   `/v1/product-edits` namespace with `product_creation.mode=off` explicitly
   exercised, per the spec's own test requirement.
7. **Task 9 (native regression + commit)** — full Jest/lint/typecheck/Android
   build/bundle, single commit per the phase file's existing script.

## Verification plan

Mirrors the phase file's own per-task RED→GREEN gates; nothing to add there.
At the phase boundary: `pnpm --dir apps/mobile test`, `lint`, `typecheck`,
`android:build`, and the Metro bundle smoke-build, then commit
`apps/mobile` + `pnpm-lock.yaml` only (file ownership: mobile app only, per
plan.md's exclusivity rule for Phase 5).

## Items for team-lead / cross-agent coordination before I start coding

- Confirm exact reCAPTCHA Enterprise Mobile SDK pins once Task 1's proof
  build runs — plan.md flags Android 18.8.0 / iOS 18.9.0+ as documentation
  baselines to verify, not accepted versions yet.
- Confirm whether mobile's `RECAPTCHA_SITE_KEY_ANDROID`/`_IOS` values already
  exist somewhere (ops/infra secrets) or need provisioning alongside this
  phase — I didn't find them in `apps/mobile/.env`/`.env.example`.
- No file-ownership conflicts found with Phase 6 (admin, already merged) or
  Phase 7 (dev-3, in progress) — Phase 5's file list is entirely under
  `apps/mobile/`, disjoint from both.

Ready to start Task 1 (native proof) the moment Phase 7 lands and this plan
gets a nod.
