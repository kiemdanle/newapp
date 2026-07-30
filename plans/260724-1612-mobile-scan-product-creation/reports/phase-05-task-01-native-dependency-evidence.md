# Phase 5 Task 1: native dependency compatibility evidence

Not a compile proof (this container has no Android/iOS toolchain — see
`phase-05-native-verification-checklist.md`, which converts this evidence
into an executable Step 1 for the user). This document is the "documented-
compatible pending compile proof" research team-lead asked for, so a real
proof-build failure has a concrete list of what was already checked versus
what's still unknown.

## react-native-image-crop-picker — pinned 0.51.1

- Latest published version on npm as of this write-up (queried
  `registry.npmjs.org` directly): `0.51.1`, published 2024-10-21.
- The published `package.json` for the `v0.51.1` git tag (fetched from
  `raw.githubusercontent.com`) contains a `codegenConfig` block:
  `{"name": "RNCImageCropPickerSpec", "type": "modules", "jsSrcsDir": "src",
  "android": {"javaPackageName": "com.reactnative.ivpusic.imagepicker"}}`.
  This is the RN codegen declaration TurboModules/autolinking under the New
  Architecture require — its *presence* is direct, checkable evidence of
  New-Architecture support, not just a changelog claim.
- The library's own README states plainly: "If you are using react native
  new architecture, you have to use react-native-image-crop-picker version
  >= 0.50.0." The `v0.50.0` release notes (2024-05-29) list "New Architecture
  support" as the headline change — `0.51.1` is a patch line on top of that,
  not a separate rewrite.
- `peerDependencies` are unpinned (`"react": "*"`, `"react-native": "*"`),
  so there's no declared floor conflicting with RN 0.76.9.
- Known caveat, explicitly NOT applicable to this pin: an iOS crash reported
  against `v0.41.6` (pre-New-Arch, Dec 2024) combined with RN 0.76.2 — that
  version predates the New-Architecture codegen work entirely, which is
  exactly why the pin here is `0.51.1`, not `0.41.x`.
- Gap: no changelog entry explicitly says "tested against RN 0.76.9" (last
  release was Oct 2024, before/around RN 0.76's stabilization window) — the
  codegen-config evidence is structural, not a maintainer's direct claim.
  This is the actual unknown Step 1 of the checklist resolves.

## @google-cloud/recaptcha-enterprise-react-native — pinned 18.9.2

- This is Google's own first-party bridge (`GoogleCloudPlatform/recaptcha-
  enterprise-react-native` on GitHub, published as
  `@google-cloud/recaptcha-enterprise-react-native` on npm) — not a
  community wrapper. Confirms team-lead/dev-3's 18.9.x baseline: latest
  published version queried directly from the npm registry is `18.9.2`.
- `peerDependencies` are unpinned (`"react": "*"`, `"react-native": "*"`).
  Its own internal `devDependencies` pin `react-native` to a nightly
  `0.87.0-nightly-*` build for the library's own example/test harness — by
  the time RN reached that nightly range, RN's legacy (non-Fabric) bridge
  had already been dropped entirely, so a library whose own CI runs against
  that nightly cannot be relying on legacy-bridge-only APIs. That's indirect
  but real evidence of New-Architecture compatibility, even though (unlike
  image-crop-picker) its `package.json` has no explicit `codegenConfig`
  block — it may use a different native-module registration path that
  doesn't need codegen, or a manual/interop-layer bridge; this document
  doesn't resolve which, only that it isn't relying on removed legacy-only
  bridge behavior.
- Install/init API confirmed directly from the README (`raw.githubusercontent.com`,
  not a search-engine summary): `const client = await
  Recaptcha.fetchClient(SITE_KEY)` once per app lifetime, then `const token =
  await client.execute(RecaptchaAction.custom('submit_product'))`. This is
  exactly what `apps/mobile/src/security/product-creation-assessment.ts`
  implements (singleton client cache + `RecaptchaAction.custom`).
- Podfile requirement stated in the README: `use_frameworks! :linkage =>
  :static`, plus a Flipper-disable note. This repo's `apps/mobile/ios/Podfile`
  already gates `use_frameworks!` behind a `USE_FRAMEWORKS` env var and has
  no Flipper wiring at all — the verification checklist's Step 1 tells the
  user to run `USE_FRAMEWORKS=static pod install` and flag if any Flipper-
  shaped conflict shows up (it shouldn't, since there's nothing to disable,
  but that's exactly the kind of assumption the actual pod install should
  confirm rather than this document asserting untested).

## Adapter isolation (both libraries)

Per team-lead's mitigation instruction, all usage is confined to two files so
a failed proof build's blast radius is one file per library, not the editor:

- `apps/mobile/src/features/products/photo-picker-adapter.ts` —
  `takePhoto`/`choosePhotos`/`cleanupTemp`, the only file importing
  `react-native-image-crop-picker`. 12 Jest cases (cancellation-is-silent,
  10 MiB advisory rejection, no-enlargement, scoped-not-global cleanup, exact
  compression/JPEG-forcing options asserted) — all passing on this container.
- `apps/mobile/src/security/product-creation-assessment.ts` —
  `executeProductSubmitAssessment`, the only file importing
  `@google-cloud/recaptcha-enterprise-react-native`. 4 Jest cases
  (platform-correct site key selection, single-init-across-calls, missing-
  key fail-fast) — all passing.

Both files, their tests, `apps/mobile/package.json`, `pnpm-lock.yaml`,
`apps/mobile/.env.example`, and `apps/mobile/tests/mocks/react-native-config.ts`
are the full Task 1 diff. `pnpm --dir apps/mobile typecheck` and a scoped
`eslint` run on exactly these two source+test file pairs are both clean; the
repo-wide `pnpm --dir apps/mobile lint` has 12 pre-existing errors in
unrelated files (deal/giveaway forms, a11y descriptors, unused vars) not
touched by this change.
