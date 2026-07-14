# Red-Team Review — Scope & Complexity Critic (YAGNI / Contract Verifier)

**Plan:** `260714-0728-mobile-bare-rn-migration`
**Reviewer perspective:** Hostile scope & complexity critic. Verification role: Contract Verifier — are phase boundaries and success criteria the right size, and does any phase secretly bundle multiple independent cutovers?
**Method:** Every finding grep/glob-verified against `apps/mobile`, `api`, `packages` in the worktree. No linting/building of the plan.

---

## Finding 1: Phase 3 is a 37-file atomic rewrite — unreviewable and unrecoverable as a single commit

- **Severity:** Critical
- **Location:** Phase 3, "Navigation to React Navigation" — Implementation step 6 ("Remove filesystem-router layouts in the same atomic commit as the navigator cutover") and Risk Assessment ("single atomic commit").
- **Flaw:** The phase mandates one atomic commit that (a) rewrites navigation imports/params in **31 route components**, (b) deletes **4 filesystem-router layouts**, (c) creates a full `src/navigation/` tree (root stack + auth stack + tab navigator + authenticated stack + typed param lists + central linking config), (d) builds **2 brand-new screens** (`notifications`, `account`), and (e) implements deep-link capture on cold start and warm app. That is 37+ touched route files plus new navigation infrastructure in a single indivisible unit. No human or AI reviewer can meaningfully review a diff of this size, and if any one of 31 ports is wrong the whole commit must be reverted, losing the correct 30. "Atomic" here is being used to justify "un-stageable," which is the opposite of safe.
- **Failure scenario:** Reviewer approves the mega-commit because the happy path compiles; a param-type regression in `giveaway/[id]/rate.tsx` or a broken signed-out redirect ships undetected because it was buried in a 37-file diff. Rolling it back also reverts the FCM-adjacent groundwork and the two new screens, forcing a re-do.
- **Evidence:**
  - 31 non-layout route files: `find apps/mobile/app -name '*.tsx' ! -name '_layout.tsx'` → 31. Includes nested routes `apps/mobile/app/(app)/giveaway/[id]/manage.tsx`, `.../giveaway/[id]/rate.tsx`, `apps/mobile/app/(app)/product/[id]/review.tsx`.
  - 4 layouts to delete: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(app)/(tabs)/_layout.tsx`, `apps/mobile/app/(auth)/_layout.tsx`.
  - 32 files import `expo-router` today (`rg -l expo-router apps/mobile/app apps/mobile/src` → 32), each needing a hook/prop swap.
- **Suggested fix:** The atomicity requirement is real (no half-migrated router tree can boot) but it does not require one *commit* — it requires one *cutover moment*. Split Phase 3 into: (3a) build `src/navigation/` + param lists + linking config + the 2 new screens behind the still-live expo-router, verified in isolation; (3b) port route components in reviewable batches on a branch; (3c) a final small flip commit that swaps the entrypoint gate and deletes the 4 layouts. The flip commit is atomic and tiny; the 31 ports are reviewable. If the plan insists on literal single-commit, it must justify why staged branches are unacceptable.

---

## Finding 2: Phase 1's stated rationale — "deleting dead variants shrinks the phase 3/7 surface" — is false; the variants do not live in the migrated tree

- **Severity:** High
- **Location:** Phase 1 Overview ("Doing this first shrinks the surface that navigation migration (phase 3) must relocate and that phase 7 must restyle"); plan.md sequencing rationale ("1 before all: deleting dead theme variants shrinks what phases 3/7 must relocate").
- **Flaw:** Phase 3 migrates files under `apps/mobile/app/**` (the router tree). The variant components live in `apps/mobile/src/components/` and the theme files in `packages/theme/src/themes/` — neither is under `app/`, so deleting them removes **zero** files from Phase 3's relocation surface. The load-bearing justification for front-loading Phase 1 does not hold. This is scope-sequencing built on an unverified claim.
- **Failure scenario:** The team front-loads a whole cleanup phase believing it de-risks the migration, then discovers Phase 3 is exactly as large as before. The real ordering constraint (theme selectable-set must be final before Phase 7 restyles) would have been satisfied just as well by doing the deletion lazily in Phase 7, avoiding a dedicated phase and an extra snapshot-churn cycle before the migration even starts.
- **Evidence:**
  - Variants live outside `app/`: `apps/mobile/src/components/{BentoTile,ClayButton,ClayCard,GlassCard,MD3Chip,MD3FAB,MD3ListRow,MD3TextField}.tsx`.
  - Phase 3 "Related Code Files" scopes modifications to `apps/mobile/app/**` and `src/navigation/`, `src/referral/*` — not `src/components`.
- **Suggested fix:** Either correct the rationale (the true benefit is only for Phase 7 restyle and for finishing the theme selectable-set) or fold the dead-code deletion into Phase 7's step 4 ("sweep for remaining obsolete style variants… remove them"), which already exists. Do not stand up a separate front-loaded phase on a benefit that the file layout contradicts.

---

## Finding 3: Phase 1 claims live feature-screen usage of GlassCard/ClayCard/MD3Chip that does not exist — the "replace usages before delete" work is largely phantom

- **Severity:** High
- **Location:** Phase 1 Architecture: "feature screens reference `GlassCard`, `ClayCard`, `MD3Chip` per the earlier scan" and Implementation step 4 ("Replace all dead-variant usages with canonical primitives").
- **Flaw:** Of the 8 variant components the phase plans to replace-then-delete, **7 have zero live imports** anywhere in `apps/mobile`. Only `MD3ListRow` is actually imported (once). The plan sizes step 4 ("replace all dead-variant usages") as if multiple feature screens consume Glass/Clay/MD3 components; the codebase says otherwise. This inflates the phase and, worse, propagates a factual error from an "earlier scan" into an executable plan without re-verification — exactly the AI-plan risk of trusting prior prose over current ground truth.
- **Failure scenario:** An executor budgets time to rewrite feature screens off GlassCard/ClayCard/MD3Chip, finds nothing to rewrite, and either wastes the cycle or assumes the grep is wrong and hunts for phantom usages.
- **Evidence:**
  - `rg "GlassCard|ClayCard|MD3Chip" apps/mobile/src` excluding own defs → **no matches** (zero live references).
  - Per-component live-reference sweep (excluding each component's own definition file): only `MD3ListRow` returns a hit → `apps/mobile/app/(app)/settings/index.tsx:6` (`import { MD3ListRow }`), used at line 55–56 behind `if (theme.id === 'material')`.
- **Suggested fix:** Correct the Architecture claim to: "7 of 8 variant components (`BentoTile`, `ClayButton`, `ClayCard`, `GlassCard`, `MD3Chip`, `MD3FAB`, `MD3TextField`) have no live imports and are safe to delete outright; only `MD3ListRow` has one live import at `settings/index.tsx:6`, gated by a `theme.id === 'material'` branch that is already unreachable since `VALID_IDS` excludes `material`." The real Phase 1 work is: remove one dead branch + delete 8 files + drop 3 theme exports. That is a small chore, not a phase.

---

## Finding 4: The theme constraint is already effectively enforced in code — Phase 1's "finish an incomplete constraint" is mostly dead-code removal, not a de-risking prerequisite

- **Severity:** Medium
- **Location:** Phase 1 Overview / plan.md validation table ("Phase 1 *finishes* an incomplete constraint").
- **Flaw:** `VALID_IDS` already restricts selectable themes to `['system','expyrico','expyricoDark']` and the store rejects anything else. The residual work is cosmetic: fix copy in `theme.tsx` ("four looks") and remove an already-unreachable `theme.id === 'material'` branch. The plan elevates this to a foundational phase that "all others depend on." The dependency graph makes phases 2–8 blockedBy phase 1, meaning the entire migration is gated behind a copy edit and a dead-branch deletion. That is inverted priority: the migration does not need the theme copy fixed to proceed.
- **Failure scenario:** Migration work (the actual risk and effort) sits blocked in the graph behind a low-value cleanup phase; if Phase 1 snapshot churn stalls review, the whole plan stalls.
- **Evidence:**
  - `apps/mobile/src/theme/store.ts:12` — `const VALID_IDS: readonly ThemePreference[] = ['system', 'expyrico', 'expyricoDark'];` and `:18` rejects non-members. `material` is already non-selectable.
  - `settings/index.tsx:55` — `if (theme.id === 'material')` branch is already unreachable given the above.
- **Suggested fix:** Demote Phase 1 to a small prerequisite chore folded into Phase 2 (baseline), or explicitly break the `blockedBy` edge so migration phases 2–6 can proceed in parallel with the cosmetic theme cleanup. Only the *selectable set* must be final before Phase 7 — and it already is.

---

## Finding 5: Phase 4 bundles 8+ independent capability cutovers behind one success gate

- **Severity:** High
- **Location:** Phase 4, "Native capability replacements" — the 10-row capability table and single success-criteria block.
- **Flaw:** Phase 4 swaps secure-store (keychain+async-storage), camera/barcode (Vision Camera), notifications (FCM token), linking, splash, status bar, Apple auth, vector icons, and device/constants/assets — each an independent native integration with its own native-config, permission, and failure surface — under one phase with one atomic-ish success gate. These have no ordering dependency on each other (keychain migration is unrelated to Vision Camera autolinking), so bundling them provides no cohesion benefit; it only enlarges the blast radius. A regression in the keychain re-implementation (which the plan flags can break session hydration) is entangled in the same phase as camera native config.
- **Failure scenario:** Vision Camera Android autolinking fails on the emulator; because it shares a phase with the secure-store rewrite, the whole phase's completion is blocked and the (working) keychain migration cannot be signed off or built upon independently.
- **Evidence:**
  - 8 distinct expo capability modules imported in `src` today: `rg -o "expo-[a-z-]+|@expo/[a-z-]+" apps/mobile/src | sort -u` → `@expo/vector-icons`, `expo-apple-authentication`, `expo-camera`, `expo-constants`, `expo-device`, `expo-notifications`, `expo-router`, `expo-secure-store` — each replaced independently in this one phase.
  - Files touched span unrelated subsystems: `src/auth/secure-store.ts`, `src/features/scan/*`, `src/features/push/registerPushToken.ts`, root provider bootstrap.
- **Suggested fix:** Split Phase 4 into independently-verifiable sub-phases grouped by risk: (4a) storage (keychain + async-storage + session-store, the session-hydration risk), (4b) camera/scan (native autolinking risk), (4c) the low-risk swaps (status bar, icons, linking, splash, device/constants), (4d) FCM token acquisition + Apple-auth adapter. Each gets its own build check. The plan already lists them as separate rows — that is the natural seam.

---

## Finding 6: Phase 7 restyles "every route" — 53 files — as a single phase with a single "every route" success criterion

- **Severity:** High
- **Location:** Phase 7, "Apply Expyrico visual system" — Success Criteria "Every route renders under one shell/card/tab language."
- **Flaw:** Phase 7 restyles all 31 route components plus the feature-component library (22 `.tsx` under `src/features`) = 53 files, across 4 screen families, in one phase. The success criterion "every route" is a single unbounded gate: the phase is not "done" until all 53 files conform, so there is no partial-completion checkpoint. This is the same reviewability problem as Phase 3 but for presentation, and it makes the plan's final substantive phase the largest.
- **Failure scenario:** Batch 2 (auth) and batch 3 (pantry) restyle cleanly, but batch 4 (community: deals/giveaways/claims/ratings/invites/reports) stalls on a card-language conflict. The single "every route" gate keeps the entire phase open, so the completed auth/pantry work cannot be landed and closed.
- **Evidence:**
  - 31 route tsx + 22 `src/features/*.tsx` = 53 files. Feature dirs: `deals, expiry, giveaways, households, push, records, referral, scan`.
  - Phase 7 already internally names 4 batches (auth / pantry / community / account) but binds them to one phase and one gate.
- **Suggested fix:** Promote the 4 internal batches to 4 phases (or 4 independently-closable sub-tasks each with its own success criterion), so each screen family lands and is reviewed on its own. "Every route" as an atomic gate should be a final verification checklist item, not the completion condition of a 53-file phase.

---

## Finding 7: Combining two specs into one strictly-sequential 8-phase chain couples independent deliverables and serializes work that has no data dependency

- **Severity:** Medium
- **Location:** plan.md "Sequencing decision" + "Phase dependency graph" (`1 ──▶ 2 ──▶ … ──▶ 8`, "Strictly sequential").
- **Flaw:** The visual-consistency spec (phases 1 and 7) and the Expo-removal migration (phases 2–6, 8) are stapled into one strictly-linear chain. The stated reason — "they edit the same route and screen files" — is true for Phase 7 (which must run after the final navigation structure exists) but not for Phase 1, which edits `src/components` and `packages/theme`, files the migration phases 2–6 barely touch. Making phase 2 `blockedBy` phase 1 serializes the migration behind theme cleanup for no technical reason (see Findings 2 and 4). The "mega-plan" framing hides that ~2 of 8 phases are a different deliverable that could proceed in parallel.
- **Failure scenario:** The migration (the higher-risk, higher-value work) is delayed because the linear graph forces it to wait on visual-cleanup phases; a stall anywhere in 1→6 blocks the visual system entirely, even though most of the visual primitives (Phase 1) are independent of the migration.
- **Evidence:**
  - Phase 1 file scope (`src/components`, `packages/theme`) vs Phase 2 file scope (`apps/mobile/package.json`, root `package.json`, `.env.example`, `react-native.config.js`) — disjoint. No shared file forces `2 blockedBy 1`.
  - plan.md explicitly asserts the only hard coupling: "phase 7 after 6, apply visuals once, on the final React Navigation screen tree." That justifies 7's position but not 1's.
- **Suggested fix:** Keep only the genuine edge (7 after 6). Let Phase 1's theme cleanup run in parallel with 2–5 (it shares no files), and gate only Phase 7 on both the migration and the finished primitives. If the tooling requires a linear chain, at least document that 1↔2–5 have no file overlap and could be reordered, so a stall in one does not block the other.

---

## Finding 8: Phase 5's forward migration silently drops all existing push tokens — a data-affecting decision buried in an implementation step

- **Severity:** Medium
- **Location:** Phase 5, "Push contract to FCM" — Implementation step 1 ("revokes all legacy tokens") and Requirements ("Legacy Expo tokens are revoked during the forward migration").
- **Flaw:** The migration renames `expoPushToken` → `deviceToken` and revokes every existing token, forcing all users to re-register. This is a user-visible, irreversible data event (every device silently stops receiving push until it re-registers) presented as a routine step, not surfaced as an acceptance-criterion or rollout risk requiring product sign-off. From a scope lens this is fine engineering; from a contract lens it is a breaking behavioral change to a live table smuggled into a phase whose success criteria only check symbol absence and clean local `prisma migrate`.
- **Failure scenario:** Migration ships; all production devices lose push silently until each user re-opens the app and re-grants permission. Because it was framed as an internal rename, no one scheduled user comms or verified re-registration coverage.
- **Evidence:**
  - `api/prisma/schema.prisma:206` — `expoPushToken String @unique` (the column being renamed + wiped of validity).
  - `packages/shared/src/schemas/record.ts:115` — Expo token regex; old tokens fail new native validation, so revocation is mandatory, not optional.
  - Phase 5 success criteria test only "prisma migrate applies cleanly on a disposable local DB" — no criterion for verified device re-registration coverage or a rollout note.
- **Suggested fix:** Add an explicit acceptance criterion and risk entry: "All existing push subscriptions are invalidated by this migration; devices must re-register on next launch. Confirm re-registration path fires on cold start and note the user-facing push gap in rollout." Elevate it out of a buried implementation step.

---

## Summary of scope verdict

The migration's real risk lives in **Phase 3** (37-file router cutover) and the **capability/visual bundling** (Phases 4 and 7). The plan compounds this by front-loading a **Phase 1** whose stated de-risking rationale is contradicted by the file layout (variants aren't in the migrated tree) and whose usage claims are factually wrong (7 of 8 variants are already dead, theme set already constrained in code). The strict 1→8 chain serializes two independent deliverables. Net: the plan is over-structured at the cheap end (Phase 1) and under-decomposed at the expensive end (Phases 3, 4, 7).

**Top cuts / re-splits, in priority order:**
1. Decompose Phase 3 into build → batched ports → tiny atomic flip (Finding 1).
2. Split Phase 4 by capability risk group; split Phase 7 into its 4 named batches (Findings 5, 6).
3. Demote Phase 1 to a chore folded into Phase 2 or Phase 7; correct its false rationale and usage claims (Findings 2, 3, 4).
4. Break the `2 blockedBy 1` edge; keep only `7 after 6` (Finding 7).
5. Surface Phase 5's token-wipe as a rollout risk + acceptance criterion (Finding 8).

---

**Status: DONE_WITH_CONCERNS** — Plan is executable in intent but mis-sized: Phase 3 (37-file atomic commit), Phase 4 (8 bundled cutovers), and Phase 7 (53-file single gate) are too large to review or land safely, while Phase 1 is an over-promoted chore justified by two grep-falsified claims.
