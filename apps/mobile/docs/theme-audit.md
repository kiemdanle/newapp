# Theme audit

Generated 2026-06-18. Lists every non-tokenized visual value in mobile screen files and tracks WCAG AA contrast sign-offs.

## Methodology

Greps for `#[0-9a-fA-F]{3,8}`, `shadow*`, `elevation:`, `borderRadius:<n>`, `fontSize:<n>`, `fontWeight:<n>`. See Phase A Task A1 of the M4 plan for exact commands.

## Tokenization status

As of the latest sweep, the following raw values were replaced:

- `apps/mobile/src/components/MD3FAB.tsx`: `fontSize: 24` → `t.typeRamp.titleLarge.fontSize`
- `apps/mobile/app/(app)/settings/theme.tsx`: `borderRadius: 6` → `theme.radii.sm`

Zero remaining hex literals, raw shadow/elevation, borderRadius, fontSize, or fontWeight literals were found in `apps/mobile/app/` or `apps/mobile/src/components/` outside of theme files and snapshot output.

## WCAG AA contrast — palette sign-off required

The expanded contrast test (text 4.5:1, non-text/borders 3:1) surfaces the following failing pairs. Per M4 Task F1, theme hex values are user-chosen design decisions and must NOT be changed without explicit sign-off. These pairs are recorded here and skipped in `apps/mobile/tests/unit/contrast.test.ts` pending resolution.

| Theme | Foreground | Background | Measured | Required | Options |
|-------|------------|------------|----------|----------|---------|
| expyrico | text | bgElevated | ~4.35 | 4.5 | (a) darken text, (b) lighten bgElevated, (c) exempt (used only for decorative/disabled) |
| expyrico | textMuted | bg | ~3.82 | 4.5 | sign-off needed |
| expyrico | textMuted | bgElevated | ~2.78 | 4.5 | sign-off needed |
| expyrico | danger | bgElevated | ~4.07 | 4.5 | sign-off needed |
| expyrico | success | bgElevated | ~3.85 | 4.5 | sign-off needed |
| expyrico | border | bg | ~1.86 | 3.0 | sign-off needed |
| expyrico | border | bgElevated | ~1.36 | 3.0 | sign-off needed |
| expyrico | accent | bgElevated | ~1.77 | 3.0 | sign-off needed |
| expyrico | primary | bgElevated | ~2.33 | 3.0 | sign-off needed |
| bento | textMuted | bg | ~4.40 | 4.5 | sign-off needed |
| bento | textInverse | accent | ~1.60 | 4.5 | sign-off needed |
| bento | danger | bg | ~2.45 | 4.5 | sign-off needed |
| bento | danger | bgElevated | ~2.69 | 4.5 | sign-off needed |
| bento | success | bg | ~2.31 | 4.5 | sign-off needed |
| bento | success | bgElevated | ~2.54 | 4.5 | sign-off needed |
| bento | border | bg | ~1.15 | 3.0 | sign-off needed |
| bento | border | bgElevated | ~1.27 | 3.0 | sign-off needed |
| bento | accent | bg | ~1.52 | 3.0 | sign-off needed |
| bento | accent | bgElevated | ~1.67 | 3.0 | sign-off needed |
| clay | textMuted | bg | ~3.94 | 4.5 | sign-off needed |
| clay | textMuted | bgElevated | ~4.17 | 4.5 | sign-off needed |
| clay | textInverse | primary | ~3.36 | 4.5 | sign-off needed |
| clay | textInverse | accent | ~1.58 | 4.5 | sign-off needed |
| clay | success | bg | ~2.39 | 4.5 | sign-off needed |
| clay | success | bgElevated | ~2.54 | 4.5 | sign-off needed |
| clay | border | bg | ~1.19 | 3.0 | sign-off needed |
| clay | border | bgElevated | ~1.26 | 3.0 | sign-off needed |
| clay | accent | bg | ~1.58 | 3.0 | sign-off needed |
| clay | accent | bgElevated | ~1.67 | 3.0 | sign-off needed |
| material | border | bg | ~1.11 | 3.0 | sign-off needed |
| material | border | bgElevated | ~1.32 | 3.0 | sign-off needed |

> **Action required:** For each row, choose (a) darken foreground, (b) lighten background, or (c) document that the token is used only for decorative/disabled UI exempt from the obligation. Do not edit theme hex without sign-off.

## Fix order

1. Resolve palette sign-off for contrast failures
2. Re-enable skipped contrast assertions
3. Regenerate snapshots if theme hex changes
