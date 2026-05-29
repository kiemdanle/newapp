# M4 — Polish + Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Pantry app to a shippable state: implement the three secondary themes (Bento Grid, Soft Clay, Material You) across every mobile screen, complete the WCAG AA + screen-reader + large-text accessibility pass, set up EAS Build/Update profiles, prepare the iOS + Android store submissions, write every operational runbook (rollback, restore, secrets, sessions, incidents, uptime), run a security review and the soft-launch checklist.

**Architecture:** No new product features — M4 is polish + ops. Theme work edits screens built in M0c/M1/M2 to consume tokens correctly and adds three new visual treatments on top of the existing `ThemeProvider` cross-fade. Accessibility work is a sweep across the same screens plus token contrast tests. The rest is documentation: runbooks under `docs/runbooks/`, store-submission notes under `apps/mobile/docs/`, and legal text under `docs/legal/`.

**Tech Stack:** Expo SDK latest, Expo Router, NativeWind, `@pantry/theme`, Reanimated 3, React Native Testing Library (RNTL), Vitest, Maestro, `wcag-contrast`, `eslint-plugin-react-native-a11y`, EAS Build, EAS Update, App Store Connect, Google Play Console, UptimeRobot.

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md` sections 2.10, 3, 7.5, 10.2, 11, 13.

**Prerequisite:** M0a, M0b, M0c, M0d, M1, M2, and M3 complete. Aurora Glass theme polished. All screens functional. Deploy pipeline live. Backups configured.

**Out of scope for M4:**
- New product features (anything beyond M3)
- New themes beyond the four (spec §12)
- Internationalization (spec §12)
- v1.1 monitoring stack (Grafana + Loki) — only UptimeRobot in v1

---

## Execution order — backend-first (2026-05-26)

The project is re-sequenced to build **backend + admin first (Track A)**, then **mobile (Track B)**. This file is **Track B, final step (polish + launch: themes, a11y, store — entire plan).** Track B order: M0c → M1 (mobile) → M2 (mobile) → M5–M8 (screens) → M4. All backend/admin (Track A) plans are built and deployed before ANY mobile (Track B) work begins.

---

## Validation amendments — 2026-05-26

These corrections were applied after a validation pass. They are folded into the relevant tasks below; this list is a plain-language summary.

1. **Security-review login assertion uses camelCase.** The admin-login TOTP check in `security-review.md` (Task referencing the production login curl) now reads `jq .requiresTotp` instead of `requires_totp`. The API contract returns the field in camelCase (`requiresTotp`), so the snake_case probe would always be `null` and the check would silently never fire.
2. **WCAG AA contrast test expanded (Task F1).** The contrast test previously checked only ~6 normal-text pairs at 4.5:1 and omitted `text.muted` foregrounds and non-text/UI-border pairs. It now also asserts `text.muted` on surface/background at 4.5:1 (WCAG 1.4.3) and `border`/`accent` boundary pairs at 3:1 (WCAG 1.4.11), each pair carrying its own threshold. Importantly, no theme hex is changed to make the test pass: where expanded pairs fail (e.g. Bento `text.muted` ≈ #8A8A8A on white ≈ 3.5:1), the task records them under a clearly-flagged "Palette sign-off required" note and waits for the user to approve a re-tune or exemption before any token is edited. The test coverage is added now; the color tokens are left unchanged pending sign-off.

---

## File map

This plan **creates** the following files and **modifies** many existing screens to consume tokens. Bold files contain runbook or legal content written out in full inside the plan.

```
pantry/
├── apps/mobile/
│   ├── eas.json                                            CREATE
│   ├── app.config.ts                                       MODIFY (adaptive icon, splash, plugins, channels)
│   ├── .eslintrc.cjs                                       MODIFY (add plugin:react-native-a11y/all)
│   ├── package.json                                        MODIFY (add deps)
│   ├── docs/
│   │   ├── theme-audit.md                                  CREATE — checklist output of Task A1
│   │   ├── build-and-release.md                            CREATE
│   │   ├── assets-checklist.md                             CREATE
│   │   ├── ios-submission.md                               CREATE **runbook**
│   │   ├── android-submission.md                           CREATE **runbook**
│   │   └── a11y-manual-checklist.md                        CREATE **runbook**
│   ├── src/
│   │   ├── components/
│   │   │   ├── BentoTile.tsx                               CREATE
│   │   │   ├── ClayCard.tsx                                CREATE
│   │   │   ├── ClayButton.tsx                              CREATE
│   │   │   ├── MD3Chip.tsx                                 CREATE
│   │   │   ├── MD3ListRow.tsx                              CREATE
│   │   │   ├── MD3FAB.tsx                                  CREATE
│   │   │   ├── MD3TextField.tsx                            CREATE
│   │   │   └── ThemePreviewCard.tsx                        MODIFY (replace placeholder with real miniature)
│   │   └── theme/
│   │       └── ThemeProvider.tsx                           MODIFY (verify cross-fade across 4 themes)
│   ├── app/
│   │   ├── (auth)/welcome.tsx                              MODIFY (tokenize, a11y)
│   │   ├── (auth)/sign-in.tsx                              MODIFY (tokenize, a11y, MD3TextField mapping)
│   │   ├── (auth)/sign-up.tsx                              MODIFY (tokenize, a11y)
│   │   ├── (auth)/forgot-password.tsx                      MODIFY (tokenize, a11y)
│   │   ├── (auth)/verify-email.tsx                         MODIFY (tokenize, a11y)
│   │   ├── (app)/(tabs)/home.tsx                           MODIFY (Bento grid render path, a11y)
│   │   ├── (app)/(tabs)/browse.tsx                         MODIFY (tokenize, a11y)
│   │   ├── (app)/(tabs)/reviews.tsx                        MODIFY (tokenize, a11y)
│   │   ├── (app)/(tabs)/profile.tsx                        MODIFY (tokenize, a11y)
│   │   ├── (app)/scan.tsx                                  MODIFY (MD3 FAB, a11y)
│   │   ├── (app)/record/[id].tsx                           MODIFY (tokenize, a11y)
│   │   ├── (app)/product/[id].tsx                          MODIFY (tokenize, a11y)
│   │   ├── (app)/product/[id]/review.tsx                   MODIFY (tokenize, a11y)
│   │   ├── (app)/settings/index.tsx                        MODIFY (tokenize, a11y, MD3 list rows)
│   │   └── (app)/settings/theme.tsx                        MODIFY (real preview cards)
│   ├── tests/
│   │   ├── unit/contrast.test.ts                           CREATE
│   │   ├── snapshots/                                      CREATE (per-theme snapshots)
│   │   │   ├── welcome.test.tsx
│   │   │   ├── sign-in.test.tsx
│   │   │   ├── home.test.tsx
│   │   │   ├── browse.test.tsx
│   │   │   ├── reviews.test.tsx
│   │   │   ├── product.test.tsx
│   │   │   ├── settings.test.tsx
│   │   │   └── theme-switcher.test.tsx
│   │   └── helpers/renderWithTheme.tsx                     CREATE
│   └── maestro/
│       └── flows/theme-switch.yaml                         CREATE
├── packages/theme/
│   ├── src/tokens.ts                                       MODIFY (add elevation.clay, MD3 elevation, type ramp)
│   ├── src/themes/aurora.ts                                MODIFY (provide values for new tokens)
│   ├── src/themes/bento.ts                                 MODIFY (full implementation)
│   ├── src/themes/clay.ts                                  MODIFY (full implementation)
│   └── src/themes/material.ts                              MODIFY (full implementation)
├── docs/
│   ├── legal/
│   │   ├── privacy-policy.md                               CREATE **full draft**
│   │   └── terms.md                                        CREATE **full draft**
│   └── runbooks/
│       ├── restore-drill.md                                CREATE **runbook**
│       ├── rollback.md                                     CREATE **runbook**
│       ├── revoke-all-sessions.md                          CREATE **runbook**
│       ├── rotate-secrets.md                               CREATE **runbook**
│       ├── incident-response.md                            CREATE **runbook**
│       ├── uptime-monitoring.md                            CREATE **runbook**
│       ├── security-review.md                              CREATE **runbook**
│       ├── soft-launch.md                                  CREATE **runbook**
│       └── release-checklist.md                            CREATE **runbook**
└── .github/workflows/
    └── ci.yml                                              MODIFY (add a11y lint + snapshot job)
```

---

## Conventions

- **TDD where logic exists.** Contrast assertions, snapshot tests, Maestro flow — all get tests written first that fail before the implementation. Runbooks and store-submission docs are deliverables in themselves: write them complete in this plan.
- **Conventional commits.** Scopes: `mobile`, `theme`, `infra`, `docs`. Examples: `feat(theme): implement Bento Grid tokens`, `feat(mobile): replace hex literals with tokens in sign-in`, `docs(infra): add rollback runbook`.
- **Commit after every passing task.** Snapshot regeneration counts as a single commit per screen.
- **Tokens only.** No hex literals, no raw shadow defs, no raw radius numbers in screen files. The audit in Task A1 produces the violation list.
- **Re-use, do not reinvent.** ThemeProvider, `useTheme()`, `Button`, `Card`, `Input` already exist from M0c. M4 adds theme-specific primitives (`BentoTile`, `ClayCard`, `MD3*`) and wires them into existing screens.
- **a11y is a CI gate.** `pnpm -C apps/mobile lint` must pass with `eslint-plugin-react-native-a11y`. Contrast tests must pass. Snapshot tests must pass.

---

## Phase A — Theme audit and token expansion

### Task A1: Sweep every screen for non-tokenized values

**Files:**
- Create: `apps/mobile/docs/theme-audit.md`

- [ ] **Step 1: Find every hex literal in `apps/mobile/app/` and `apps/mobile/src/components/`**

```bash
grep -RIn --include='*.tsx' --include='*.ts' -E '#[0-9a-fA-F]{3,8}\b' apps/mobile/app apps/mobile/src/components
```
Expected: a list of files and line numbers. Save the output.

- [ ] **Step 2: Find every raw `shadowOpacity`, `shadowOffset`, `shadowRadius`, `elevation:` literal**

```bash
grep -RIn --include='*.tsx' --include='*.ts' -E '(shadowOpacity|shadowOffset|shadowRadius|elevation):' apps/mobile/app apps/mobile/src/components
```

- [ ] **Step 3: Find every raw `borderRadius:` number literal**

```bash
grep -RIn --include='*.tsx' --include='*.ts' -E 'borderRadius:\s*[0-9]+' apps/mobile/app apps/mobile/src/components
```

- [ ] **Step 4: Find every raw `fontSize:` or `fontWeight:` literal**

```bash
grep -RIn --include='*.tsx' --include='*.ts' -E '(fontSize|fontWeight):\s*[0-9'\''"]' apps/mobile/app apps/mobile/src/components
```

- [ ] **Step 5: Write `apps/mobile/docs/theme-audit.md` with the findings**

```markdown
# Theme audit

Generated YYYY-MM-DD. Lists every non-tokenized visual value in mobile screen files. Each violation must be replaced with a `useTheme()` token before M4 ships.

## Methodology

Greps for `#[0-9a-fA-F]{3,8}`, `shadow*`, `elevation:`, `borderRadius:<n>`, `fontSize:<n>`, `fontWeight:<n>`. See Phase A Task A1 for exact commands.

## Violations

### apps/mobile/app/(auth)/welcome.tsx
- Line N: `color: '#FFFFFF'` → use `tokens.colors.text.onAccent`
- ...

### apps/mobile/app/(auth)/sign-in.tsx
- Line N: `borderRadius: 12` → use `tokens.radii.md`
- ...

[Repeat per file from the grep output. One bullet per finding.]

## Fix order

1. Auth screens (Phase C)
2. Tab screens (Phase D)
3. Detail screens (Phase E)
4. Settings (Phase F)

Each violation is checked off as it's replaced.
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/docs/theme-audit.md
git commit -m "docs(mobile): add theme audit checklist"
```

---

### Task A2: Add missing tokens to `packages/theme/src/tokens.ts`

**Files:**
- Modify: `packages/theme/src/tokens.ts`

- [ ] **Step 1: Read the current token shape**

```bash
cat packages/theme/src/tokens.ts
```
Expected: existing types for `Colors`, `Radii`, `Shadows`, `Typography`, `Spacing`, `Animations`.

- [ ] **Step 2: Write a failing typecheck for new fields**

Add to `packages/theme/src/tokens.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Theme, ClayElevation, MD3Elevation, TypeRamp } from '@pantry/theme';

describe('extended token shape', () => {
  it('exposes ClayElevation with rim + base + ambient', () => {
    expectTypeOf<ClayElevation>().toEqualTypeOf<{
      rim: string;
      base: string;
      ambient: string;
    }>();
  });
  it('exposes MD3Elevation 0..5', () => {
    expectTypeOf<MD3Elevation>().toEqualTypeOf<{
      level0: string;
      level1: string;
      level2: string;
      level3: string;
      level4: string;
      level5: string;
    }>();
  });
  it('TypeRamp covers MD3 display/headline/title/body/label', () => {
    expectTypeOf<TypeRamp>().toMatchTypeOf<{
      displayLarge: { fontSize: number; lineHeight: number; fontWeight: string };
      headlineLarge: { fontSize: number; lineHeight: number; fontWeight: string };
      titleLarge:    { fontSize: number; lineHeight: number; fontWeight: string };
      bodyLarge:     { fontSize: number; lineHeight: number; fontWeight: string };
      labelLarge:    { fontSize: number; lineHeight: number; fontWeight: string };
    }>();
  });
});
```

- [ ] **Step 3: Run the test, watch it fail**

```bash
pnpm -C packages/theme test
```
Expected: FAIL — types not exported.

- [ ] **Step 4: Extend `packages/theme/src/tokens.ts`**

```ts
export type ClayElevation = {
  rim: string;      // CSS box-shadow string for inner rim light
  base: string;     // primary drop shadow
  ambient: string;  // soft ambient occlusion shadow
};

export type MD3Elevation = {
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
};

export type TypeRampEntry = { fontSize: number; lineHeight: number; fontWeight: string };
export type TypeRamp = {
  displayLarge: TypeRampEntry; displayMedium: TypeRampEntry; displaySmall: TypeRampEntry;
  headlineLarge: TypeRampEntry; headlineMedium: TypeRampEntry; headlineSmall: TypeRampEntry;
  titleLarge: TypeRampEntry; titleMedium: TypeRampEntry; titleSmall: TypeRampEntry;
  bodyLarge: TypeRampEntry; bodyMedium: TypeRampEntry; bodySmall: TypeRampEntry;
  labelLarge: TypeRampEntry; labelMedium: TypeRampEntry; labelSmall: TypeRampEntry;
};

// D1 (M0a): we extend M0a's existing `Theme` interface in place rather than inventing a parallel type.
// M0a's tokens.ts already declares `Theme` with `colors / radii / shadows / typography / spacing / animation`.
// M4 adds the following fields directly to M0a's Theme interface (edit packages/theme/src/tokens.ts):
//
//   elevation: { clay: ClayElevation; md3: MD3Elevation };
//   typeRamp: TypeRamp;
//
// The four shipped themes (aurora/bento/clay/material) — created in M0a — are extended in Phase B below
// to provide values for the new fields. No theme files are duplicated.

export type { Theme } from '@pantry/theme';
```

- [ ] **Step 5: Run the typecheck test, watch it pass**

```bash
pnpm -C packages/theme test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/src/tokens.ts packages/theme/src/tokens.test.ts
git commit -m "feat(theme): extend tokens with ClayElevation, MD3Elevation, TypeRamp"
```

---

### Task A3: Provide new token values in `aurora.ts`

**Files:**
- Modify: `packages/theme/src/themes/aurora.ts`

- [ ] **Step 1: Write a failing test that aurora has no `undefined` tokens**

Add to `packages/theme/src/themes/aurora.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aurora } from './aurora.js';

describe('aurora theme provides every token', () => {
  it('elevation.clay', () => {
    expect(aurora.elevation.clay.rim).toBeTruthy();
    expect(aurora.elevation.clay.base).toBeTruthy();
    expect(aurora.elevation.clay.ambient).toBeTruthy();
  });
  it('elevation.md3', () => {
    for (const k of ['level0','level1','level2','level3','level4','level5'] as const) {
      expect(aurora.elevation.md3[k]).toBeTruthy();
    }
  });
  it('typeRamp.bodyLarge has size + lineHeight', () => {
    expect(aurora.typeRamp.bodyLarge.fontSize).toBeGreaterThan(0);
    expect(aurora.typeRamp.bodyLarge.lineHeight).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, watch fail**

```bash
pnpm -C packages/theme test -- aurora
```
Expected: FAIL.

- [ ] **Step 3: Add values to `aurora.ts`**

Aurora is glass — its clay elevation is intentionally low-impact (no theme should ever request clay tokens on aurora, but defaults are required so `useTheme()` never returns undefined). MD3 levels also fall back to soft glass surfaces.

```ts
elevation: {
  clay: {
    rim: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    base: '0 8px 24px rgba(0,0,0,0.35)',
    ambient: '0 2px 8px rgba(0,0,0,0.20)',
  },
  md3: {
    level0: 'none',
    level1: '0 1px 2px rgba(0,0,0,0.25)',
    level2: '0 2px 4px rgba(0,0,0,0.30)',
    level3: '0 4px 8px rgba(0,0,0,0.35)',
    level4: '0 6px 12px rgba(0,0,0,0.40)',
    level5: '0 8px 16px rgba(0,0,0,0.45)',
  },
},
typeRamp: {
  displayLarge:   { fontSize: 57, lineHeight: 64, fontWeight: '400' },
  displayMedium:  { fontSize: 45, lineHeight: 52, fontWeight: '400' },
  displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '400' },
  headlineLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '400' },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
  headlineSmall:  { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  titleLarge:     { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySmall:      { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500' },
},
```

- [ ] **Step 4: Run, watch pass**

```bash
pnpm -C packages/theme test -- aurora
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/themes/aurora.ts packages/theme/src/themes/aurora.test.ts
git commit -m "feat(theme): backfill new tokens for aurora"
```

---

### Task A4b: `parseShadow` helper (M4 self-review #12)

M0a's theme tokens give shadows as CSS strings (e.g., `"0 4px 12px rgba(0,0,0,0.12)"`). React Native needs them as separate `shadowColor / shadowOffset / shadowOpacity / shadowRadius / elevation` props.

**Files:**
- Create: `apps/mobile/src/theme/shadow.ts`
- Create: `apps/mobile/src/theme/shadow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/theme/shadow.test.ts
import { describe, it, expect } from 'vitest';
import { parseShadow } from './shadow';

describe('parseShadow', () => {
  it('parses "x y blur color" form', () => {
    const r = parseShadow('0 4px 12px rgba(0,0,0,0.12)');
    expect(r.shadowOffset).toEqual({ width: 0, height: 4 });
    expect(r.shadowRadius).toBe(12);
    expect(r.shadowColor).toBe('rgba(0,0,0,0.12)');
    expect(r.shadowOpacity).toBe(1);
    expect(r.elevation).toBeGreaterThanOrEqual(2);
  });

  it('handles negative y offsets', () => {
    const r = parseShadow('0 -2px 4px rgba(255,255,255,0.5)');
    expect(r.shadowOffset).toEqual({ width: 0, height: -2 });
  });

  it('handles a separate opacity in a 5-segment form (x y blur color opacity)', () => {
    const r = parseShadow('0 8px 24px #000000 0.16');
    expect(r.shadowColor).toBe('#000000');
    expect(r.shadowOpacity).toBe(0.16);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `pnpm --filter @pantry/mobile test shadow`

- [ ] **Step 3: Implement**

```ts
// apps/mobile/src/theme/shadow.ts
export type RNShadowProps = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const PX = (s: string) => Number.parseFloat(s.replace('px', ''));

export function parseShadow(css: string): RNShadowProps {
  // Tokenise on whitespace, but keep rgba(...) / hsl(...) etc. intact.
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of css.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (buf) parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);

  // Forms supported:
  //   "x y blur color"           (4 parts)
  //   "x y blur color opacity"   (5 parts, opacity overrides)
  const x = PX(parts[0] ?? '0');
  const y = PX(parts[1] ?? '0');
  const blur = PX(parts[2] ?? '0');
  const color = parts[3] ?? 'rgba(0,0,0,0.1)';
  const opacity = parts[4] ? Number.parseFloat(parts[4]) : 1;

  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: Math.max(2, Math.round(blur / 2)),
  };
}
```

- [ ] **Step 4: Run, verify PASS** — `pnpm --filter @pantry/mobile test shadow`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/theme/shadow.ts apps/mobile/src/theme/shadow.test.ts
git commit -m "feat(mobile): parseShadow helper for theme tokens (M4#12)"
```

---

## Phase B — Implement the three secondary themes

### Task B1: Bento Grid theme tokens

**Files:**
- Modify: `packages/theme/src/themes/bento.ts`

Bento Grid: light surface, single accent (warm coral `#FF6B5C`), small radii (8/12/16), tight 1px borders instead of shadows, sans-serif type ramp.

- [ ] **Step 1: Write a failing snapshot of the bento token object**

Add to `packages/theme/src/themes/bento.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bento } from './bento.js';

describe('bento theme', () => {
  it('uses a light background', () => {
    expect(bento.colors.background).toBe('#FAFAF7');
  });
  it('uses the single coral accent', () => {
    expect(bento.colors.accent).toBe('#FF6B5C');
  });
  it('uses small radii', () => {
    expect(bento.radii.md).toBe(12);
  });
  it('snapshot', () => {
    expect(bento).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, watch fail**

```bash
pnpm -C packages/theme test -- bento
```
Expected: FAIL (values mismatch).

- [ ] **Step 3: Implement `bento.ts`**

```ts
import type { Theme } from '@pantry/theme';

export const bento: Theme = {
  name: 'bento',
  colors: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    surfaceAlt: '#F3F2EE',
    border: '#E5E3DD',
    accent: '#FF6B5C',
    accentMuted: '#FFE5E1',
    text: {
      primary: '#1A1A1A',
      secondary: '#5C5C5C',
      muted: '#8A8A8A',
      onAccent: '#FFFFFF',
    },
    status: {
      success: '#2E7D5B',
      warning: '#C77700',
      danger:  '#C0392B',
      info:    '#1F6FB5',
    },
  },
  radii: { none: 0, sm: 8, md: 12, lg: 16, xl: 20, pill: 9999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
  shadows: {
    none: 'none',
    sm: 'none',         // bento favors borders, not shadows
    md: 'none',
    lg: '0 4px 12px rgba(0,0,0,0.06)',
  },
  elevation: {
    clay: { rim: 'none', base: 'none', ambient: 'none' },
    md3:  { level0: 'none', level1: 'none', level2: 'none', level3: 'none', level4: 'none', level5: 'none' },
  },
  typography: { fontFamily: 'Inter', monoFamily: 'JetBrainsMono' },
  typeRamp: {
    displayLarge:   { fontSize: 48, lineHeight: 56, fontWeight: '700' },
    displayMedium:  { fontSize: 40, lineHeight: 48, fontWeight: '700' },
    displaySmall:   { fontSize: 32, lineHeight: 40, fontWeight: '700' },
    headlineLarge:  { fontSize: 28, lineHeight: 36, fontWeight: '600' },
    headlineMedium: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
    headlineSmall:  { fontSize: 20, lineHeight: 28, fontWeight: '600' },
    titleLarge:     { fontSize: 20, lineHeight: 28, fontWeight: '600' },
    titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '600' },
    titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    bodySmall:      { fontSize: 12, lineHeight: 16, fontWeight: '400' },
    labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  },
  animations: { fast: 120, base: 200, slow: 320 },
};
```

- [ ] **Step 4: Run, watch pass**

```bash
pnpm -C packages/theme test -- bento -u
```
Expected: PASS (snapshot written on first run).

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/themes/bento.ts packages/theme/src/themes/bento.test.ts packages/theme/src/themes/__snapshots__
git commit -m "feat(theme): implement Bento Grid tokens"
```

---

### Task B2: Soft Clay theme tokens

**Files:**
- Modify: `packages/theme/src/themes/clay.ts`

Soft Clay: warm peach background `#F8E8DC`, chunky 3D depth with multi-layer shadow (rim light + base drop + ambient), very large radii (16/24/32/pill), generous spacing.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { clay } from './clay.js';

describe('clay theme', () => {
  it('uses warm peach background', () => {
    expect(clay.colors.background).toBe('#F8E8DC');
  });
  it('uses chunky radii', () => {
    expect(clay.radii.md).toBe(24);
  });
  it('clay elevation has rim, base, ambient', () => {
    expect(clay.elevation.clay.rim).toMatch(/inset/);
    expect(clay.elevation.clay.base).toMatch(/rgba/);
    expect(clay.elevation.clay.ambient).toMatch(/rgba/);
  });
  it('snapshot', () => {
    expect(clay).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, watch fail**

```bash
pnpm -C packages/theme test -- clay
```

- [ ] **Step 3: Implement `clay.ts`**

```ts
import type { Theme } from '@pantry/theme';

export const clay: Theme = {
  name: 'clay',
  colors: {
    background: '#F8E8DC',
    surface:    '#FBEFE6',
    surfaceAlt: '#F1DFD2',
    border:     '#E8D2C0',
    accent:     '#E07856',
    accentMuted:'#F5C8B7',
    text: {
      primary:   '#3A2A20',
      secondary: '#5B4537',
      muted:     '#8A7567',
      onAccent:  '#FFFFFF',
    },
    status: {
      success: '#3F8D63',
      warning: '#D48A2A',
      danger:  '#C0392B',
      info:    '#4A7DB5',
    },
  },
  radii: { none: 0, sm: 16, md: 24, lg: 32, xl: 40, pill: 9999 },
  spacing: { xs: 6, sm: 12, md: 18, lg: 24, xl: 36, '2xl': 48 },
  shadows: {
    none: 'none',
    sm: '0 2px 4px rgba(58,42,32,0.08)',
    md: '0 6px 12px rgba(58,42,32,0.10)',
    lg: '0 12px 24px rgba(58,42,32,0.14)',
  },
  elevation: {
    clay: {
      rim: 'inset 0 2px 0 rgba(255,255,255,0.60), inset 0 -2px 0 rgba(58,42,32,0.06)',
      base: '0 8px 16px rgba(58,42,32,0.12)',
      ambient: '0 2px 6px rgba(58,42,32,0.08)',
    },
    md3: {
      level0: 'none',
      level1: '0 1px 2px rgba(58,42,32,0.06)',
      level2: '0 2px 6px rgba(58,42,32,0.08)',
      level3: '0 6px 12px rgba(58,42,32,0.10)',
      level4: '0 10px 18px rgba(58,42,32,0.12)',
      level5: '0 14px 24px rgba(58,42,32,0.14)',
    },
  },
  typography: { fontFamily: 'Nunito', monoFamily: 'JetBrainsMono' },
  typeRamp: {
    displayLarge:   { fontSize: 52, lineHeight: 60, fontWeight: '800' },
    displayMedium:  { fontSize: 44, lineHeight: 52, fontWeight: '800' },
    displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '800' },
    headlineLarge:  { fontSize: 30, lineHeight: 40, fontWeight: '700' },
    headlineMedium: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
    headlineSmall:  { fontSize: 22, lineHeight: 30, fontWeight: '700' },
    titleLarge:     { fontSize: 20, lineHeight: 28, fontWeight: '700' },
    titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '700' },
    titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    bodyLarge:      { fontSize: 17, lineHeight: 26, fontWeight: '500' },
    bodyMedium:     { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    bodySmall:      { fontSize: 13, lineHeight: 18, fontWeight: '500' },
    labelLarge:     { fontSize: 15, lineHeight: 22, fontWeight: '700' },
    labelMedium:    { fontSize: 13, lineHeight: 18, fontWeight: '700' },
    labelSmall:     { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  },
  animations: { fast: 160, base: 240, slow: 360 },
};
```

- [ ] **Step 4: Run, watch pass**

```bash
pnpm -C packages/theme test -- clay -u
```

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/themes/clay.ts packages/theme/src/themes/clay.test.ts packages/theme/src/themes/__snapshots__
git commit -m "feat(theme): implement Soft Clay tokens"
```

---

### Task B3: Material You theme tokens

**Files:**
- Modify: `packages/theme/src/themes/material.ts`

MD3 dynamic purple: primary `#6750A4`, on-primary `#FFFFFF`, surface `#FEF7FF`, surface-variant `#E7E0EC`. Full MD3 elevation 0..5. Roboto type ramp.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { material } from './material.js';

describe('material theme', () => {
  it('uses MD3 primary purple', () => {
    expect(material.colors.accent).toBe('#6750A4');
  });
  it('surface is MD3 surface', () => {
    expect(material.colors.surface).toBe('#FEF7FF');
  });
  it('elevation.md3.level3 is non-empty', () => {
    expect(material.elevation.md3.level3).not.toBe('none');
  });
  it('snapshot', () => {
    expect(material).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, watch fail**

```bash
pnpm -C packages/theme test -- material
```

- [ ] **Step 3: Implement `material.ts`**

```ts
import type { Theme } from '@pantry/theme';

export const material: Theme = {
  name: 'material',
  colors: {
    background: '#FEF7FF',
    surface:    '#FEF7FF',
    surfaceAlt: '#E7E0EC',
    border:     '#CAC4D0',
    accent:     '#6750A4',
    accentMuted:'#EADDFF',
    text: {
      primary:   '#1D1B20',
      secondary: '#49454F',
      muted:     '#79747E',
      onAccent:  '#FFFFFF',
    },
    status: {
      success: '#386A20',
      warning: '#7D5260',
      danger:  '#B3261E',
      info:    '#1976D2',
    },
  },
  radii: { none: 0, sm: 8, md: 12, lg: 16, xl: 28, pill: 9999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px 1px rgba(0,0,0,0.15)',
    md: '0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.30)',
    lg: '0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.30)',
  },
  elevation: {
    clay: { rim: 'none', base: 'none', ambient: 'none' },
    md3: {
      level0: 'none',
      level1: '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px 1px rgba(0,0,0,0.15)',
      level2: '0 1px 2px rgba(0,0,0,0.30), 0 2px 6px 2px rgba(0,0,0,0.15)',
      level3: '0 1px 3px rgba(0,0,0,0.30), 0 4px 8px 3px rgba(0,0,0,0.15)',
      level4: '0 2px 3px rgba(0,0,0,0.30), 0 6px 10px 4px rgba(0,0,0,0.15)',
      level5: '0 4px 4px rgba(0,0,0,0.30), 0 8px 12px 6px rgba(0,0,0,0.15)',
    },
  },
  typography: { fontFamily: 'Roboto', monoFamily: 'RobotoMono' },
  typeRamp: {
    displayLarge:   { fontSize: 57, lineHeight: 64, fontWeight: '400' },
    displayMedium:  { fontSize: 45, lineHeight: 52, fontWeight: '400' },
    displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '400' },
    headlineLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '400' },
    headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
    headlineSmall:  { fontSize: 24, lineHeight: 32, fontWeight: '400' },
    titleLarge:     { fontSize: 22, lineHeight: 28, fontWeight: '500' },
    titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '500' },
    titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    bodySmall:      { fontSize: 12, lineHeight: 16, fontWeight: '400' },
    labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  },
  animations: { fast: 150, base: 200, slow: 300 },
};
```

- [ ] **Step 4: Run, watch pass**

```bash
pnpm -C packages/theme test -- material -u
```

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/themes/material.ts packages/theme/src/themes/material.test.ts packages/theme/src/themes/__snapshots__
git commit -m "feat(theme): implement Material You tokens"
```

---

### Task B4: BentoTile component

**Files:**
- Create: `apps/mobile/src/components/BentoTile.tsx`
- Create: `apps/mobile/tests/snapshots/components/BentoTile.test.tsx`

- [ ] **Step 1: Write failing snapshot test**

```tsx
import { render } from '@testing-library/react-native';
import { BentoTile } from '../../../src/components/BentoTile';
import { renderWithTheme } from '../../helpers/renderWithTheme';

describe('BentoTile', () => {
  it.each(['aurora','bento','clay','material'] as const)('renders in %s theme', (theme) => {
    const tree = renderWithTheme(
      <BentoTile size="md" accent={false} title="Milk" subtitle="Expires Fri" />,
      theme,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Write `apps/mobile/tests/helpers/renderWithTheme.tsx`**

```tsx
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import type { ReactElement } from 'react';

export function renderWithTheme(ui: ReactElement, themeName: 'aurora'|'bento'|'clay'|'material') {
  return render(<ThemeProvider initial={themeName}>{ui}</ThemeProvider>);
}
```

- [ ] **Step 3: Run, watch fail (no component)**

```bash
pnpm -C apps/mobile test -- BentoTile
```
Expected: FAIL — `Cannot find module '../../../src/components/BentoTile'`.

- [ ] **Step 4: Implement `BentoTile.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Size = 'sm' | 'md' | 'lg' | 'wide';
type Props = {
  size: Size;
  accent?: boolean;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: React.ReactNode;
};

const sizeStyle = (size: Size) => {
  switch (size) {
    case 'sm':   return { aspectRatio: 1,    flex: 1 };
    case 'md':   return { aspectRatio: 1,    flex: 1 };
    case 'lg':   return { aspectRatio: 0.75, flex: 1 };
    case 'wide': return { aspectRatio: 2,    flex: 1 };
  }
};

export function BentoTile({ size, accent, title, subtitle, onPress, children }: Props) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onTouchEnd={onPress}
      style={[
        sizeStyle(size),
        {
          backgroundColor: accent ? t.colors.accent : t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii.md,
          padding: t.spacing.lg,
          minHeight: 88, // a11y touch target
        },
      ]}
    >
      <Text style={{
        color: accent ? t.colors.text.onAccent : t.colors.text.primary,
        fontSize: t.typeRamp.titleMedium.fontSize,
        lineHeight: t.typeRamp.titleMedium.lineHeight,
        fontWeight: t.typeRamp.titleMedium.fontWeight as any,
      }}>{title}</Text>
      {subtitle ? (
        <Text style={{
          color: accent ? t.colors.text.onAccent : t.colors.text.secondary,
          fontSize: t.typeRamp.bodySmall.fontSize,
          lineHeight: t.typeRamp.bodySmall.lineHeight,
          marginTop: t.spacing.xs,
        }}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}
```

- [ ] **Step 5: Run, watch pass and write snapshot**

```bash
pnpm -C apps/mobile test -- BentoTile -u
```
Expected: PASS (4 snapshots written).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/BentoTile.tsx apps/mobile/tests/helpers/renderWithTheme.tsx apps/mobile/tests/snapshots/components
git commit -m "feat(mobile): add BentoTile component"
```

---

### Task B5: ClayCard component

**Files:**
- Create: `apps/mobile/src/components/ClayCard.tsx`
- Create: `apps/mobile/tests/snapshots/components/ClayCard.test.tsx`

- [ ] **Step 1: Failing snapshot**

```tsx
import { renderWithTheme } from '../../helpers/renderWithTheme';
import { ClayCard } from '../../../src/components/ClayCard';
import { Text } from 'react-native';

describe('ClayCard', () => {
  it.each(['aurora','bento','clay','material'] as const)('renders in %s', (theme) => {
    const tree = renderWithTheme(
      <ClayCard><Text>Hello</Text></ClayCard>, theme,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm -C apps/mobile test -- ClayCard
```

- [ ] **Step 3: Implement**

```tsx
import { View, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = { children: React.ReactNode; padded?: boolean };

export function ClayCard({ children, padded = true }: Props) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radii.md,
        padding: padded ? t.spacing.lg : 0,
        // Multi-layer depth: rim light + base drop + ambient.
        // React Native ignores box-shadow strings; map to native props.
        ...(ios ? {
          shadowColor: '#3A2A20',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        } : {
          elevation: 6,
        }),
      }}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Run, write snapshots**

```bash
pnpm -C apps/mobile test -- ClayCard -u
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ClayCard.tsx apps/mobile/tests/snapshots/components/ClayCard.test.tsx apps/mobile/tests/snapshots/components/__snapshots__
git commit -m "feat(mobile): add ClayCard component"
```

---

### Task B6: ClayButton component

**Files:**
- Create: `apps/mobile/src/components/ClayButton.tsx`
- Create: `apps/mobile/tests/snapshots/components/ClayButton.test.tsx`

- [ ] **Step 1: Failing snapshot**

```tsx
import { renderWithTheme } from '../../helpers/renderWithTheme';
import { ClayButton } from '../../../src/components/ClayButton';

describe('ClayButton', () => {
  it.each(['aurora','bento','clay','material'] as const)('renders in %s', (theme) => {
    expect(renderWithTheme(
      <ClayButton title="Save" onPress={() => {}} />, theme,
    ).toJSON()).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm -C apps/mobile test -- ClayButton
```

- [ ] **Step 3: Implement**

```tsx
import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = { title: string; onPress: () => void; disabled?: boolean };

export function ClayButton({ title, onPress, disabled }: Props) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        backgroundColor: disabled ? t.colors.surfaceAlt : t.colors.accent,
        borderRadius: t.radii.lg,
        paddingVertical: t.spacing.md,
        paddingHorizontal: t.spacing.xl,
        minHeight: 48, // a11y
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: pressed ? 2 : 0 }],
        ...(ios ? {
          shadowColor: '#3A2A20',
          shadowOffset: { width: 0, height: pressed ? 2 : 6 },
          shadowOpacity: pressed ? 0.08 : 0.14,
          shadowRadius: pressed ? 6 : 12,
        } : {
          elevation: pressed ? 2 : 6,
        }),
      })}
    >
      <Text style={{
        color: t.colors.text.onAccent,
        fontSize: t.typeRamp.labelLarge.fontSize,
        fontWeight: t.typeRamp.labelLarge.fontWeight as any,
      }}>{title}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run, write snapshots**

```bash
pnpm -C apps/mobile test -- ClayButton -u
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ClayButton.tsx apps/mobile/tests/snapshots/components/ClayButton.test.tsx apps/mobile/tests/snapshots/components/__snapshots__
git commit -m "feat(mobile): add ClayButton component"
```

---

### Task B7: MD3 primitives — Chip, ListRow, FAB, TextField

**Files:**
- Create: `apps/mobile/src/components/MD3Chip.tsx`
- Create: `apps/mobile/src/components/MD3ListRow.tsx`
- Create: `apps/mobile/src/components/MD3FAB.tsx`
- Create: `apps/mobile/src/components/MD3TextField.tsx`
- Create: `apps/mobile/tests/snapshots/components/MD3.test.tsx`

- [ ] **Step 1: Write a combined failing snapshot test**

```tsx
import { renderWithTheme } from '../../helpers/renderWithTheme';
import { MD3Chip } from '../../../src/components/MD3Chip';
import { MD3ListRow } from '../../../src/components/MD3ListRow';
import { MD3FAB } from '../../../src/components/MD3FAB';
import { MD3TextField } from '../../../src/components/MD3TextField';

describe.each(['aurora','bento','clay','material'] as const)('MD3 primitives in %s', (theme) => {
  it('MD3Chip', () => {
    expect(renderWithTheme(<MD3Chip label="Dairy" selected />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3ListRow', () => {
    expect(renderWithTheme(<MD3ListRow leadingIcon="bell" title="Notifications" subtitle="On" />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3FAB', () => {
    expect(renderWithTheme(<MD3FAB icon="qrcode-scan" onPress={() => {}} accessibilityLabel="Scan" />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3TextField', () => {
    expect(renderWithTheme(<MD3TextField label="Email" value="" onChangeText={() => {}} />, theme).toJSON()).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm -C apps/mobile test -- MD3
```

- [ ] **Step 3: Implement `MD3Chip.tsx`**

```tsx
import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export function MD3Chip({ label, selected, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={{
        height: 32,
        minWidth: 48,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.sm,
        borderWidth: 1,
        borderColor: selected ? t.colors.accent : t.colors.border,
        backgroundColor: selected ? t.colors.accentMuted : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{
        color: selected ? t.colors.accent : t.colors.text.primary,
        fontSize: t.typeRamp.labelLarge.fontSize,
        fontWeight: t.typeRamp.labelLarge.fontWeight as any,
      }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Implement `MD3ListRow.tsx`**

```tsx
import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  leadingIcon?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
};

export function MD3ListRow({ title, subtitle, trailing, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={{
        minHeight: 56,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.surface,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{
          color: t.colors.text.primary,
          fontSize: t.typeRamp.bodyLarge.fontSize,
          lineHeight: t.typeRamp.bodyLarge.lineHeight,
        }}>{title}</Text>
        {subtitle ? (
          <Text style={{
            color: t.colors.text.secondary,
            fontSize: t.typeRamp.bodySmall.fontSize,
          }}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
```

- [ ] **Step 5: Implement `MD3FAB.tsx`**

```tsx
import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = { icon: string; onPress: () => void; accessibilityLabel: string };

export function MD3FAB({ icon, onPress, accessibilityLabel }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 56, height: 56,
        borderRadius: t.radii.lg,
        backgroundColor: t.colors.accent,
        alignItems: 'center', justifyContent: 'center',
        ...(Platform.OS === 'ios'
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 5 }
          : { elevation: 6 }),
      }}
    >
      <Text style={{ color: t.colors.text.onAccent, fontSize: 24 }}>{icon === 'qrcode-scan' ? '⊟' : '+'}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 6: Implement `MD3TextField.tsx`**

```tsx
import { View, TextInput, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
};

export function MD3TextField({ label, value, onChangeText, error, secureTextEntry, keyboardType }: Props) {
  const t = useTheme();
  return (
    <View style={{ marginVertical: t.spacing.sm }}>
      <Text style={{
        color: error ? t.colors.status.danger : t.colors.text.secondary,
        fontSize: t.typeRamp.labelMedium.fontSize,
        marginBottom: t.spacing.xs,
      }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: error ? t.colors.status.danger : t.colors.border,
          borderRadius: t.radii.sm,
          paddingHorizontal: t.spacing.md,
          color: t.colors.text.primary,
          fontSize: t.typeRamp.bodyLarge.fontSize,
          backgroundColor: t.colors.surface,
        }}
      />
      {error ? (
        <Text style={{ color: t.colors.status.danger, fontSize: t.typeRamp.bodySmall.fontSize, marginTop: t.spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 7: Run, write snapshots**

```bash
pnpm -C apps/mobile test -- MD3 -u
```
Expected: PASS, 16 snapshots written (4 components × 4 themes).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/MD3*.tsx apps/mobile/tests/snapshots/components/MD3.test.tsx apps/mobile/tests/snapshots/components/__snapshots__
git commit -m "feat(mobile): add MD3 Chip, ListRow, FAB, TextField primitives"
```

---

## Phase C — Theme provider + preview cards

### Task C1: Verify cross-fade works across all four themes

**Files:**
- Modify: `apps/mobile/src/theme/ThemeProvider.tsx`
- Create: `apps/mobile/tests/snapshots/theme-switcher.test.tsx`

- [ ] **Step 1: Write failing test for cross-fade timing**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider, useThemeSwitcher } from '../../src/theme/ThemeProvider';
import { Text } from 'react-native';

function Probe() {
  const { theme, setTheme } = useThemeSwitcher();
  return <Text testID="probe" onPress={() => setTheme('clay')}>{theme}</Text>;
}

describe('ThemeProvider', () => {
  it('cross-fades 200ms between themes', async () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <ThemeProvider initial="aurora"><Probe /></ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('aurora');
    act(() => { getByTestId('probe').props.onPress(); });
    expect(getByTestId('probe').props.children).toBe('aurora'); // mid-fade old value still readable
    act(() => { vi.advanceTimersByTime(220); });
    expect(getByTestId('probe').props.children).toBe('clay');
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm -C apps/mobile test -- ThemeProvider
```
Expected: FAIL — either missing `useThemeSwitcher` or no cross-fade timing.

- [ ] **Step 3: Verify/patch `ThemeProvider.tsx` to wire all 4 themes + 200ms cross-fade**

Open `apps/mobile/src/theme/ThemeProvider.tsx`. Confirm:
- imports `aurora`, `bento`, `clay`, `material` from `@pantry/theme`
- the `themes` registry includes all four
- on `setTheme`, runs Animated/Reanimated `withTiming({ duration: 200 })` cross-fade between an absolute-positioned overlay holding the previous token context and the new one

Required minimum patch (only if missing):

```tsx
import { aurora, bento, clay, material } from '@pantry/theme';

const THEMES = { aurora, bento, clay, material } as const;
export type ThemeName = keyof typeof THEMES;

// In setTheme:
function setTheme(name: ThemeName) {
  Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
    setActive(name);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  });
}
```

- [ ] **Step 4: Run, watch pass**

```bash
pnpm -C apps/mobile test -- ThemeProvider
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/theme/ThemeProvider.tsx apps/mobile/tests/snapshots/theme-switcher.test.tsx
git commit -m "feat(mobile): wire 4 themes into ThemeProvider with 200ms cross-fade"
```

---

### Task C2: Real preview cards in `/settings/theme.tsx`

**Files:**
- Modify: `apps/mobile/src/components/ThemePreviewCard.tsx`
- Modify: `apps/mobile/app/(app)/settings/theme.tsx`

- [ ] **Step 1: Write failing snapshot — preview shows real surfaces, not "Preview" placeholder**

```tsx
import { renderWithTheme } from '../../helpers/renderWithTheme';
import { ThemePreviewCard } from '../../../src/components/ThemePreviewCard';

describe('ThemePreviewCard', () => {
  it.each(['aurora','bento','clay','material'] as const)('previews %s', (theme) => {
    expect(renderWithTheme(<ThemePreviewCard preview={theme} selected={false} onSelect={() => {}} />, 'aurora').toJSON()).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm -C apps/mobile test -- ThemePreviewCard
```

- [ ] **Step 3: Implement preview with real miniature surfaces**

```tsx
import { Pressable, View, Text } from 'react-native';
import { aurora, bento, clay, material } from '@pantry/theme';
import type { ThemeName } from '../theme/ThemeProvider';

const map = { aurora, bento, clay, material } as const;

type Props = { preview: ThemeName; selected: boolean; onSelect: () => void };

export function ThemePreviewCard({ preview, selected, onSelect }: Props) {
  const t = map[preview];
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityLabel={`Use ${preview} theme`}
      accessibilityState={{ selected }}
      style={{
        width: 160,
        borderRadius: 16,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.colors.accent : '#CCC',
        overflow: 'hidden',
        backgroundColor: t.colors.background,
      }}
    >
      {/* Mini header */}
      <View style={{ height: 24, backgroundColor: t.colors.accent }} />
      {/* Mini surface card */}
      <View style={{
        margin: 8,
        padding: 8,
        backgroundColor: t.colors.surface,
        borderRadius: t.radii.sm,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}>
        <Text style={{ color: t.colors.text.primary, fontSize: 10, fontWeight: '700' }}>Aa</Text>
        <Text style={{ color: t.colors.text.secondary, fontSize: 8 }}>Sample body</Text>
        <View style={{
          marginTop: 4,
          height: 14,
          width: 40,
          borderRadius: t.radii.pill,
          backgroundColor: t.colors.accent,
        }} />
      </View>
      <Text style={{
        color: t.colors.text.primary, textAlign: 'center', paddingBottom: 8, fontSize: 12, fontWeight: '600',
      }}>
        {preview[0].toUpperCase() + preview.slice(1)}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Update `app/(app)/settings/theme.tsx` to use the card**

Replace placeholder card list with:

```tsx
import { ScrollView, View, Text } from 'react-native';
import { useThemeSwitcher } from '../../../src/theme/ThemeProvider';
import { ThemePreviewCard } from '../../../src/components/ThemePreviewCard';

const ALL = ['aurora','bento','clay','material'] as const;

export default function ThemeScreen() {
  const { theme, setTheme } = useThemeSwitcher();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, flexDirection: 'row', flexWrap: 'wrap' }}>
      {ALL.map(name => (
        <ThemePreviewCard
          key={name}
          preview={name}
          selected={theme === name}
          onSelect={() => setTheme(name)}
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Run, write snapshots**

```bash
pnpm -C apps/mobile test -- ThemePreviewCard -u
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ThemePreviewCard.tsx apps/mobile/app/\(app\)/settings/theme.tsx apps/mobile/tests/snapshots/components/__snapshots__
git commit -m "feat(mobile): real miniature preview cards on theme settings"
```

---

## Phase D — Tokenize every screen (auth, tabs, detail, settings)

For each screen in this phase, follow the same 4-step pattern. List of screens:

- `(auth)/welcome.tsx`
- `(auth)/sign-in.tsx`
- `(auth)/sign-up.tsx`
- `(auth)/forgot-password.tsx`
- `(auth)/verify-email.tsx`
- `(app)/(tabs)/home.tsx`
- `(app)/(tabs)/browse.tsx`
- `(app)/(tabs)/reviews.tsx`
- `(app)/(tabs)/profile.tsx`
- `(app)/scan.tsx`
- `(app)/record/[id].tsx`
- `(app)/product/[id].tsx`
- `(app)/product/[id]/review.tsx`
- `(app)/settings/index.tsx`

### Task D1: Per-screen tokenization template (apply once per screen above)

For each screen `S`, do:

- [ ] **Step 1: Open the screen and the audit checklist; tick the violations to fix.**

```bash
$EDITOR apps/mobile/docs/theme-audit.md apps/mobile/app/S
```

- [ ] **Step 2: Replace every hex literal with `useTheme()` token**

Example diff pattern:

```diff
- <View style={{ backgroundColor: '#0E0E14', borderRadius: 12 }}>
+ const t = useTheme();
+ <View style={{ backgroundColor: t.colors.background, borderRadius: t.radii.md }}>
```

- [ ] **Step 3: Replace shadow/elevation literals with `t.shadows.*` or `t.elevation.md3.*`**

```diff
- shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }
+ ...Platform.select({
+   ios: { shadowColor: '#000', ...parseShadow(t.elevation.md3.level2) },
+   android: { elevation: 4 },
+ }),
```

(Define `parseShadow` once in `apps/mobile/src/theme/shadow.ts` if not present; it parses the CSS string into RN props. Skip if `t.shadows` already supplies RN-shaped values.)

- [ ] **Step 4: Replace fontSize/fontWeight literals with `t.typeRamp.<role>`**

- [ ] **Step 5: Run typecheck**

```bash
pnpm -C apps/mobile typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Cross-reference the audit doc — strike through fixed lines.**

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/S apps/mobile/docs/theme-audit.md
git commit -m "feat(mobile): tokenize <screen S>"
```

### Task D2 — D15: Apply Task D1 template to each screen

One commit per screen:

- [ ] D2  `(auth)/welcome.tsx`
- [ ] D3  `(auth)/sign-in.tsx` — also replace inline `<TextInput>` with `<MD3TextField>` when active theme is `material` (use a small `<ThemedTextField>` helper that switches by `t.name === 'material'`).
- [ ] D4  `(auth)/sign-up.tsx`
- [ ] D5  `(auth)/forgot-password.tsx`
- [ ] D6  `(auth)/verify-email.tsx`
- [ ] D7  `(app)/(tabs)/home.tsx` — when active theme is `bento`, render records as a 2-col grid of `<BentoTile>`. When `clay`, wrap each record in `<ClayCard>`. When `material`, use `<MD3ListRow>`. Aurora keeps existing GlassCard.
- [ ] D8  `(app)/(tabs)/browse.tsx`
- [ ] D9  `(app)/(tabs)/reviews.tsx`
- [ ] D10 `(app)/(tabs)/profile.tsx`
- [ ] D11 `(app)/scan.tsx` — replace FAB with `<MD3FAB>` for material theme.
- [ ] D12 `(app)/record/[id].tsx`
- [ ] D13 `(app)/product/[id].tsx`
- [ ] D14 `(app)/product/[id]/review.tsx`
- [ ] D15 `(app)/settings/index.tsx` — for `material`, render rows as `<MD3ListRow>`.

After D15, audit doc must show every violation struck through.

- [ ] **Step 16: Verify zero hex literals remain**

```bash
grep -RIn --include='*.tsx' -E '#[0-9a-fA-F]{3,8}\b' apps/mobile/app apps/mobile/src/components | grep -v '__snapshots__'
```
Expected: empty output. (Hex strings inside theme files in `packages/theme` are allowed and not searched.)

- [ ] **Step 17: Final commit**

```bash
git commit --allow-empty -m "chore(mobile): theme audit complete — zero hex literals in screens"
```

---

## Phase E — Per-screen × per-theme snapshot tests

### Task E1: Welcome screen snapshots

**Files:**
- Create: `apps/mobile/tests/snapshots/welcome.test.tsx`

- [ ] **Step 1: Write the failing snapshot**

```tsx
import { renderWithTheme } from '../helpers/renderWithTheme';
import Welcome from '../../app/(auth)/welcome';

describe.each(['aurora','bento','clay','material'] as const)('welcome in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Welcome />, theme).toJSON()).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run, fail (mocks/setup may need attention; fix as you go)**

```bash
pnpm -C apps/mobile test -- welcome
```

- [ ] **Step 3: Resolve test setup until it runs, then write snapshots**

```bash
pnpm -C apps/mobile test -- welcome -u
```
Expected: PASS, 4 snapshots written.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/tests/snapshots/welcome.test.tsx apps/mobile/tests/snapshots/__snapshots__/welcome.test.tsx.snap
git commit -m "test(mobile): per-theme snapshot of welcome screen"
```

### Task E2 — E8: Snapshots for sign-in, home, browse, reviews, product, settings, theme switcher

Apply Task E1 template once per screen. One commit per screen.

- [ ] E2 `tests/snapshots/sign-in.test.tsx`
- [ ] E3 `tests/snapshots/home.test.tsx` (covers Bento-grid render path)
- [ ] E4 `tests/snapshots/browse.test.tsx`
- [ ] E5 `tests/snapshots/reviews.test.tsx`
- [ ] E6 `tests/snapshots/product.test.tsx`
- [ ] E7 `tests/snapshots/settings.test.tsx`
- [ ] E8 `tests/snapshots/theme-switcher.test.tsx` — already created in Task C1; extend with snapshot at each of the four themes.

After E8, count: at least 4 screens × 4 themes = 16 base snapshots, plus components from B4–B7 and theme-switcher = ~40 total.

```bash
find apps/mobile/tests/snapshots -name '*.snap' | wc -l
```
Expected: >= 10 snap files (4 themes per snap file collapse).

---

## Phase F — Accessibility (WCAG AA + screen reader + large text)

### Task F1: Install `wcag-contrast` and write contrast assertions

**Files:**
- Modify: `apps/mobile/package.json` (add devDep `wcag-contrast`)
- Create: `apps/mobile/tests/unit/contrast.test.ts`

- [ ] **Step 1: Add dep**

```bash
pnpm -C apps/mobile add -D wcag-contrast @types/wcag-contrast
```

- [ ] **Step 2: Write failing test**

The test must cover all three WCAG 2.1 contrast obligations, not just normal text:

- **Normal text — 4.5:1 (1.4.3 AA).** Includes `text.primary`, `text.secondary`, **and `text.muted`** foregrounds. Muted greys are easy to overlook; the light-theme muted hex (e.g. Bento `text.muted` ≈ `#8A8A8A` on white surface ≈ 3.5:1) very likely fails AA and was previously untested, letting CI go green on a real violation.
- **Non-text / UI components and borders — 3:1 (1.4.11 AA).** Includes the `border` token against the surfaces it divides, and the `accent` fill against the background it sits on (button/FAB boundary).

Each pair therefore carries its own threshold rather than a single hardcoded `4.5`.

```ts
import { describe, it, expect } from 'vitest';
import { hex } from 'wcag-contrast';
import { aurora, bento, clay, material } from '@pantry/theme';

const themes = { aurora, bento, clay, material };

// [foreground, background, minRatio]
// 4.5 → normal text (WCAG 1.4.3). 3 → non-text / UI components + borders (WCAG 1.4.11).
const PAIRS = [
  // Normal text
  ['text.primary',   'surface',    4.5],
  ['text.primary',   'background', 4.5],
  ['text.secondary', 'surface',    4.5],
  ['text.secondary', 'background', 4.5],
  ['text.muted',     'surface',    4.5],
  ['text.muted',     'background', 4.5],
  ['text.onAccent',  'accent',     4.5],
  ['status.danger',  'surface',    4.5],
  ['status.success', 'surface',    4.5],
  // Non-text / UI components and borders (3:1)
  ['border',         'surface',    3],
  ['border',         'background', 3],
  ['accent',         'background', 3],
  ['accent',         'surface',    3],
] as const;

function get(t: any, path: string) {
  return path.split('.').reduce((o, k) => o[k], t.colors);
}

describe('WCAG AA contrast (text 4.5:1, non-text/borders 3:1)', () => {
  for (const [tname, t] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${tname}: ${fg} on ${bg} (>= ${min})`, () => {
        const ratio = hex(get(t, fg), get(t, bg));
        expect(ratio).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
```

- [ ] **Step 3: Run, expect some failures**

```bash
pnpm -C apps/mobile test -- contrast
```
Expected: FAIL on any low-contrast pair. The newly-added muted-text and border pairs are the likely failures (e.g. Bento `text.muted` ≈ `#8A8A8A` on `#FFFFFF` surface ≈ 3.5:1 < 4.5).

- [ ] **Step 4: Triage failures — do NOT silently re-tune user-chosen hex**

The theme hex values (background/surface/accent/text/border per theme) are user-chosen design decisions. Adjusting them changes the look of a shipped theme, so they MUST NOT be changed to make the test pass without sign-off.

For each failing pair:
1. Record the theme, the pair, the current hex values, and the measured ratio.
2. Add the failure to the **"Palette sign-off required"** note below (`apps/mobile/docs/theme-audit.md` is the home for it; reference it from this task).
3. Leave the token unchanged until the user approves a specific re-tune (darken foreground / lighten background) or an exemption (e.g. muted text used only for genuinely decorative/disabled states that fall outside the 4.5:1 obligation).

> **Palette sign-off required.** The expanded contrast test surfaces pairs that likely fail AA at the correct thresholds. List every failing `theme: fg on bg = measured ratio (threshold)` here and resolve each with the user before M4 ships. Known suspect: Bento `text.muted` (#8A8A8A) on surface (#FFFFFF) ≈ 3.5:1 vs 4.5:1 required. Options per pair: (a) darken the foreground token, (b) lighten the background token, (c) document that the token is used only for decorative/disabled UI exempt from 1.4.3. Do not edit any theme hex in `packages/theme/src/themes/*.ts` until the user picks an option.

- [ ] **Step 5: Once sign-off is recorded, apply only the approved changes and re-run**

Apply only the hex edits the user approved (if any), refresh Phase B snapshots (`-u`) for affected themes, and re-run until green. Pairs the user exempted are removed from `PAIRS` with an inline comment citing the sign-off, not silently.

```bash
pnpm -C apps/mobile test -- contrast
```
Expected: PASS for all asserted pairs.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/tests/unit/contrast.test.ts apps/mobile/package.json apps/mobile/pnpm-lock.yaml apps/mobile/docs/theme-audit.md packages/theme/src/themes packages/theme/src/themes/__snapshots__
git commit -m "test(theme): WCAG AA contrast assertions for text, muted text, and borders"
```

---

### Task F2: Install + configure `eslint-plugin-react-native-a11y`

**Files:**
- Modify: `apps/mobile/.eslintrc.cjs`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install**

```bash
pnpm -C apps/mobile add -D eslint-plugin-react-native-a11y
```

- [ ] **Step 2: Update `.eslintrc.cjs`**

```js
module.exports = {
  extends: [
    // ... existing ...
    'plugin:react-native-a11y/all',
  ],
  plugins: ['react-native-a11y'],
  rules: {
    'react-native-a11y/has-accessibility-hint': 'off', // hints are optional; labels are mandatory
  },
};
```

- [ ] **Step 3: Run lint, expect violations**

```bash
pnpm -C apps/mobile lint
```
Expected: list of `accessibilityLabel`/`accessibilityRole` violations.

- [ ] **Step 4: Fix every violation by adding `accessibilityRole`, `accessibilityLabel`, and (where stateful) `accessibilityState`**

Walk the lint output. Common fixes:
- `<Pressable>` without role/label → add `accessibilityRole="button"`, `accessibilityLabel={...}`
- `<TouchableOpacity>` → same
- decorative `<Image>` → `accessibilityIgnoresInvertColors accessibilityElementsHidden`
- toggle controls → `accessibilityState={{ checked: value }}`

- [ ] **Step 5: Re-run lint, expect clean**

```bash
pnpm -C apps/mobile lint
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): enable react-native-a11y lint and fix all violations"
```

---

### Task F3: Touch-target audit (≥ 44pt iOS / 48dp Android)

**Files:**
- Create: `apps/mobile/tests/unit/touch-target.test.ts`

- [ ] **Step 1: Write a static check that every interactive primitive sets `minHeight >= 44`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';

const files = glob.sync('apps/mobile/src/components/**/*.tsx');
const INTERACTIVE = /<(Pressable|TouchableOpacity|TouchableHighlight|Button)\b/;
const HAS_MIN = /minHeight:\s*([0-9]+)/g;

describe('interactive primitives have minHeight >= 44', () => {
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!INTERACTIVE.test(src)) continue;
    it(f, () => {
      let found = false;
      let fail = false;
      for (const m of src.matchAll(HAS_MIN)) {
        found = true;
        if (Number(m[1]) < 44) { fail = true; break; }
      }
      expect(found, `${f} missing minHeight`).toBe(true);
      expect(fail, `${f} has minHeight < 44`).toBe(false);
    });
  }
});
```

- [ ] **Step 2: Run, fix any failing components by adding `minHeight: 48`**

```bash
pnpm -C apps/mobile test -- touch-target
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile
git commit -m "test(mobile): assert interactive components meet touch-target minimum"
```

---

### Task F4: Manual screen-reader test checklist

**Files:**
- Create: `apps/mobile/docs/a11y-manual-checklist.md`

- [ ] **Step 1: Write the checklist in full**

```markdown
# Mobile accessibility — manual screen-reader checklist

This must be run before every release. CI cannot replace it. Two devices, ~45 minutes total.

## Devices

- iOS: physical iPhone running latest iOS, VoiceOver enabled (Settings → Accessibility → VoiceOver → On)
- Android: physical Pixel running latest Android, TalkBack enabled (Settings → Accessibility → TalkBack → On)

If only one platform is available, document which was tested in the release PR and schedule the missing one within 48h.

## Setup

1. Install the `preview` channel build via TestFlight / Play Internal Testing
2. Reset to a fresh install (delete + reinstall) to walk onboarding
3. Set system font scale to 100% (Display & Brightness → Text Size = default)

## Golden path

Walk this flow with VoiceOver/TalkBack on. Confirm every numbered item.

### 1. Welcome
- [ ] "Welcome to Pantry, heading" announced first
- [ ] "Sign up, button" focusable, distinct from "Sign in, button"
- [ ] Background visual elements are not announced

### 2. Sign-up
- [ ] Email field announces "Email, text field, required"
- [ ] Password field announces "Password, secure text field, required"
- [ ] "Show password" toggle announces state changes ("on"/"off")
- [ ] Submit button disabled state announces "dimmed" / "disabled"
- [ ] Validation errors announce immediately on blur, not silently

### 3. Verify email
- [ ] Instructional text reachable in reading order
- [ ] "Resend email, button" present
- [ ] Polite live region announces "Email sent" after tapping resend

### 4. Home (empty)
- [ ] "Your pantry is empty" announced, with hint "Use the scan button to add items"
- [ ] FAB announces "Scan a barcode, button"

### 5. Scan
- [ ] Camera permission prompt focuses correctly
- [ ] Camera viewfinder is decorative (not focused)
- [ ] Cancel button reachable as first focus

### 6. Manual record
- [ ] Date picker accessible, announces selected date on change
- [ ] Quantity stepper announces value changes

### 7. Save → Home
- [ ] Toast / live region announces "Saved"
- [ ] New record card focusable, announces "Milk, expires in 5 days"

### 8. Product detail + reviews
- [ ] Star rating displays as "4 of 5 stars"
- [ ] Each review card announces author, rating, body, vote counts
- [ ] Upvote button announces state ("voted up"/"not voted")

### 9. Submit review
- [ ] Star picker is a focusable group with role `adjustable` (or radio group)
- [ ] Body text area announces character count if shown

### 10. Theme switch
- [ ] Each preview card announces name and "selected" / "not selected"
- [ ] Switching themes does not break focus (focus stays on the chosen card)

## Pass/fail

Any unchecked box = release blocked. File a ticket and fix before submitting.

## Sign-off

- Tester: _______
- Date: _______
- iOS version: _______
- Android version: _______
- Build: _______
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/docs/a11y-manual-checklist.md
git commit -m "docs(mobile): manual screen-reader release checklist"
```

---

### Task F5: Large-text support

**Files:**
- Modify: every screen file (only if `allowFontScaling={false}` is set anywhere)

- [ ] **Step 1: Search for fontScaling overrides**

```bash
grep -RIn 'allowFontScaling' apps/mobile/app apps/mobile/src
```

- [ ] **Step 2: Remove all `allowFontScaling={false}` unless inside a tightly-laid-out badge component**

For badges with no room to grow, document the cap in `apps/mobile/docs/a11y-manual-checklist.md` under a new "Known capped elements" section.

- [ ] **Step 3: Set a global font-scale cap of 1.5 via `app/_layout.tsx`**

```tsx
import { Text, TextInput } from 'react-native';
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.5;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.5;
```

- [ ] **Step 4: Manual: bump iOS Settings → Display → Text Size to maximum (Larger Text → 200%). Walk the golden path. Document any layout breaks in `a11y-manual-checklist.md`.**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/docs/a11y-manual-checklist.md
git commit -m "feat(mobile): cap font scaling at 1.5x and document large-text behavior"
```

---

## Phase G — EAS Build, EAS Update, store configuration

### Task G1: Write `apps/mobile/eas.json`

**Files:**
- Create: `apps/mobile/eas.json`

- [ ] **Step 1: Write the file**

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api-staging.pantry.example"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": { "simulator": false },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api-staging.pantry.example"
      }
    },
    "production": {
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.pantry.example"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "release@pantry.example",
        "ascAppId": "REPLACE_WITH_APPLE_APP_ID",
        "appleTeamId": "REPLACE_WITH_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

- [ ] **Step 2: Verify EAS CLI parses it**

```bash
pnpm -C apps/mobile dlx eas-cli@latest build:configure --non-interactive --platform all --profile preview
```
Expected: "Configuration is valid" or warning about missing project ID (run `eas init` if first time).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/eas.json
git commit -m "feat(mobile): EAS build profiles for development, preview, production"
```

---

### Task G2: Configure EAS Update channels and runtime version

**Files:**
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Add update + runtime config**

```ts
export default {
  expo: {
    // ... existing fields ...
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: 'https://u.expo.dev/REPLACE_WITH_PROJECT_ID',
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
  },
};
```

- [ ] **Step 2: Verify config**

```bash
pnpm -C apps/mobile expo config --type prebuild | head -40
```
Expected: includes `runtimeVersion` and `updates.url`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): wire EAS Update with appVersion runtime policy"
```

---

### Task G3: App icons + splash + adaptive icon

**Files:**
- Create: `apps/mobile/docs/assets-checklist.md`
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Write the assets checklist**

```markdown
# Mobile assets checklist

Design deliverables required before production build. Hand to the designer (or DALL·E/SVG yourself) and tick when received.

## Source assets

- [ ] `assets/icon-source.png` — 1024×1024, sRGB, no alpha, no rounded corners. Centered logo with ~10% safe-area margin. Background = Aurora purple `#5B3FFF`.
- [ ] `assets/adaptive-foreground.png` — 1024×1024, transparent background, logo fits in centered 66% safe zone (Android adaptive masking)
- [ ] `assets/adaptive-background.png` — 1024×1024, solid Aurora purple `#5B3FFF`
- [ ] `assets/splash-source.png` — 1284×2778 (iPhone 14 Pro Max). Centered logo. Background = `#0E0E14`.
- [ ] `assets/notification-icon.png` — 96×96, white silhouette on transparent (Android notification tray)
- [ ] `assets/favicon.png` — 48×48 (admin web)

## Generated derivatives

Run `pnpm -C apps/mobile expo prebuild` after dropping the source files in `assets/`. Expo generates iOS @2x/@3x and all Android density buckets automatically.

## In-app illustrations

- [ ] Empty-state for home: "No items in your pantry"
- [ ] Empty-state for browse: "No products yet"
- [ ] Empty-state for reviews: "Nothing reviewed yet"
- [ ] Error illustration for offline

All in flat 2-color SVG using the Aurora accent palette. Bundle inline as React components in `apps/mobile/src/components/illustrations/`.

## Sign-off

- Design lead: _______
- Date: _______
```

- [ ] **Step 2: Configure `app.config.ts` adaptive icon + splash**

```ts
ios: {
  icon: './assets/icon-source.png',
  // ... other ios config
},
android: {
  adaptiveIcon: {
    foregroundImage: './assets/adaptive-foreground.png',
    backgroundImage: './assets/adaptive-background.png',
  },
  package: 'com.pantry.app',
},
plugins: [
  ['expo-splash-screen', {
    image: './assets/splash-source.png',
    backgroundColor: '#0E0E14',
    resizeMode: 'contain',
  }],
  ['expo-notifications', {
    icon: './assets/notification-icon.png',
    color: '#5B3FFF',
  }],
],
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/docs/assets-checklist.md
git commit -m "feat(mobile): adaptive icon, splash, notification icon config"
```

---

### Task G4: Build-and-release runbook

**Files:**
- Create: `apps/mobile/docs/build-and-release.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Mobile build + release runbook

Source of truth for shipping mobile builds. Follow start-to-finish.

## Prerequisites

- `eas-cli` installed: `npm i -g eas-cli`
- Logged in: `eas login` (account must be Pantry org owner or admin)
- Apple Developer team membership for Pantry
- Google Play Console access for `com.pantry.app`

## Channels

| Channel       | Distribution                | When                                |
|---------------|-----------------------------|-------------------------------------|
| development   | Expo Dev Client only        | local dev on physical devices       |
| preview       | TestFlight + Play Internal  | feature branches, RC builds         |
| production    | App Store + Play Store      | tagged releases (`vX.Y.Z`)          |

## Native build

```bash
# Preview build (internal testing)
cd apps/mobile
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all
```

Output: signed `.ipa` and `.aab` artifacts in EAS dashboard. iOS takes ~25 min, Android ~10 min.

## OTA update (JS-only fix)

```bash
# Push to preview channel
eas update --branch preview --message "Fix scan crash"

# Push to production channel after staging soak
eas update --branch production --message "Fix scan crash"
```

Updates ship to all devices on the matching `runtimeVersion`. Bumping native deps requires a fresh native build, not an OTA.

## Submission

```bash
# iOS — uploads .ipa to App Store Connect, ready for TestFlight or Submit for Review
eas submit --profile production --platform ios

# Android — uploads .aab to Play Console internal track
eas submit --profile production --platform android
```

## Versioning

- `expo.version` in `app.config.ts` = user-visible (e.g., `1.4.0`)
- `runtimeVersion: { policy: 'appVersion' }` ties OTAs to the user-visible version. Bump the version when shipping a native change.
- EAS auto-increments `ios.buildNumber` and `android.versionCode` per `production` build.

## Release process (start → store)

1. Merge release branch into `main`, CI green
2. Tag: `git tag v1.4.0 && git push --tags`
3. CI builds OTA preview, posts QR code in #releases
4. QA runs `a11y-manual-checklist.md` on TestFlight + Play Internal
5. If green: `eas submit --profile production --platform all`
6. App Store: submit for review. Play Store: promote internal → closed beta → production.
7. Monitor `/admin/system/api-errors` and crash reports for 24h
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/docs/build-and-release.md
git commit -m "docs(mobile): build and release runbook"
```

---

### Task G5: iOS submission runbook

**Files:**
- Create: `apps/mobile/docs/ios-submission.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# iOS App Store submission runbook

Walk through end-to-end. First-time submission takes ~3 hours of operator time spread over 1–2 days while review queues run.

## App Store Connect setup

1. Sign in at https://appstoreconnect.apple.com with the Pantry Apple ID
2. **My Apps → "+"** → New App
3. Fields:
   - Platform: iOS
   - Name: **Pantry**
   - Primary Language: English (U.S.)
   - Bundle ID: `com.pantry.app` (must match `ios.bundleIdentifier` in `app.config.ts`)
   - SKU: `pantry-ios-001`
   - User Access: Full Access

## Info.plist usage strings

Set in `app.config.ts → ios.infoPlist`:

```ts
infoPlist: {
  NSCameraUsageDescription: 'Pantry uses the camera to scan product barcodes and QR codes, and to read printed expiry dates.',
  NSPhotoLibraryUsageDescription: 'Pantry can read an expiry date from a photo you already took.',
  NSPhotoLibraryAddUsageDescription: 'Pantry saves an optional photo of your item with the record.',
  NSUserNotificationsUsageDescription: 'Pantry notifies you before items expire so nothing goes to waste.',
  ITSAppUsesNonExemptEncryption: false,
}
```

## Signing

- Use EAS managed credentials. `eas build` creates and stores the distribution certificate + provisioning profile in EAS.
- Push notifications: `eas credentials` → iOS → Production → Push Key. Generate once per Apple Team.

## Screenshots

Required device sizes (provide PNGs, no transparency, no alpha):

| Display       | Pixel size       | Count |
|---------------|------------------|-------|
| 6.7" iPhone   | 1290 × 2796      | 3–10  |
| 6.1" iPhone   | 1179 × 2556      | 3–10  |
| 12.9" iPad    | 2048 × 2732      | 3–10  |

Recommended screens to capture:
1. Aurora Glass home with 4 records
2. Scan screen with viewfinder
3. Product detail with reviews
4. Theme switcher showing 4 previews
5. Settings → Notifications

Capture on a real device via Xcode → Devices → Take Screenshot, or via the iOS simulator at exact device dimensions.

## App information

- **Subtitle (30 chars):** "Track expiry. Don't waste."
- **Promotional text (170 chars):** "Scan groceries, set expiry dates, get reminders before they go bad. Rate products with the community. Privacy-first: no analytics, your pantry stays yours."
- **Description (4000 chars):** see `/docs/legal/store-description-ios.md` (write in Task G7 if not present; for first submission a 1-paragraph version is acceptable)
- **Keywords (100 chars):** `pantry,expiry,expiration,grocery,barcode,scan,food,waste,reminder,fridge`
- **Support URL:** https://pantry.example/support
- **Marketing URL:** https://pantry.example
- **Privacy Policy URL:** https://pantry.example/privacy (must match `/docs/legal/privacy-policy.md`)

## Privacy nutrition label

Apple → "App Privacy" → answers:

- Does this app collect data? **Yes**
- Data Linked to You:
  - **Contact Info → Email Address** (account)
  - **Identifiers → User ID** (account)
  - **User Content → Other User Content** (records, reviews)
- Data Not Linked to You:
  - **Diagnostics → Crash Data** (Expo + Sentry-free; only via Apple's opt-in)
- Data Used for Tracking: **None**
- Third-party data sharing: **None** (OFF and UPCitemdb receive only the scanned barcode value, no PII)

## Age rating

- Made for Kids: No
- Rating: **4+** (no objectionable content, no user-generated images shown without moderation)

## App Review information

- Sign-in required: Yes
- Demo account: `appreview@pantry.example` / password from 1Password vault
- Notes: "Pantry tracks personal grocery expiry dates. Test by tapping the scan FAB and entering any barcode (e.g., 5449000000996 for Coca-Cola)."

## TestFlight

1. After EAS build uploads, the build appears under **TestFlight → iOS** in ~30 min (processing).
2. **Internal Testing → "+"** group "Pantry team" → add team Apple IDs. No review required, builds available instantly.
3. **External Testing → "+"** group "Beta testers" → add up to 10k testers. Requires Beta App Review (24–48h first time, ~few hours after).
4. Provide "What to Test" notes per build.

## Submit for review

1. **App Store → iOS App → Prepare for Submission**
2. Select the uploaded build
3. Answer Export Compliance: **No** (no proprietary encryption beyond HTTPS)
4. Submit. Review takes 24–48h on average.

## Common rejection causes

- Missing Apple Sign In: present — spec §2.1 requires it because Google Sign-In is offered
- Account deletion: present — `DELETE /me` (spec §6.6) wired to Settings → Account → Delete
- Crashes during review: test the demo account flow yourself on a clean device before submitting
- Vague Privacy Policy: ensure `/docs/legal/privacy-policy.md` is published at the URL listed
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/docs/ios-submission.md
git commit -m "docs(mobile): iOS App Store submission runbook"
```

---

### Task G6: Android submission runbook

**Files:**
- Create: `apps/mobile/docs/android-submission.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Google Play Store submission runbook

Walk through end-to-end. First-time setup ~2 hours of operator time.

## Play Console setup

1. Sign in at https://play.google.com/console with the Pantry developer account ($25 one-time fee)
2. **Create app**
3. Fields:
   - App name: **Pantry**
   - Default language: English (United States)
   - App / Game: App
   - Free / Paid: Free
   - Declarations: confirm both checkboxes

## Service account for EAS submit

1. Google Cloud Console → IAM → Service Accounts → Create
2. Grant **Service Account User** + **Pub/Sub Publisher**
3. Generate JSON key, save as `apps/mobile/secrets/play-service-account.json` (gitignored)
4. In Play Console → Setup → API access → Link the service account → Grant access to this app, permissions: **Release manager**

## Target API level

Android requires target API 34 (Android 14) as of August 2024. Verify in `app.config.ts`:

```ts
android: {
  package: 'com.pantry.app',
  compileSdkVersion: 34,
  targetSdkVersion: 34,
  // ...
}
```

## Signing

EAS manages the Android upload key. App-signing key is held by Google Play (Play App Signing enrolled at first upload).

## Store listing

- **App name:** Pantry
- **Short description (80 chars):** "Track expiry dates. Rate products. Stop wasting food."
- **Full description (4000 chars):** see `/docs/legal/store-description-android.md` (first version: 1-paragraph acceptable)
- **App icon:** 512×512 PNG, 32-bit, no alpha — from `assets/icon-source.png`
- **Feature graphic:** 1024×500 PNG/JPG, no alpha
- **Phone screenshots:** at least 2, up to 8, min edge 320px, max 3840px, 16:9 or 9:16
- **7-inch tablet screenshots:** optional
- **10-inch tablet screenshots:** optional

## Categorization

- App category: **Food & Drink** (alternate: Productivity)
- Tags: pantry, grocery, expiry, food-waste

## Content rating

1. **Policy → App content → Content rating → Start questionnaire**
2. Category: **Reference, News, or Educational**
3. Answer all "No" for violence/sex/profanity/etc. User-generated reviews are profanity-filtered server-side (spec §2.8), so answer "Yes — moderated"
4. Result: should land **Everyone**

## Data safety form

**Policy → App content → Data safety**

- Does your app collect or share any required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data be deleted? **Yes** (Settings → Account → Delete; `DELETE /me`)

Data collected:

| Data type             | Collected | Shared | Required | Purpose             |
|-----------------------|-----------|--------|----------|---------------------|
| Email address         | Yes       | No     | Required | Account, comms      |
| Name                  | Yes       | No     | Optional | Display             |
| Country               | Yes       | No     | Optional | Display, IP-derived |
| Photos (record image) | Yes       | No     | Optional | App functionality   |
| User content (reviews)| Yes       | No     | Optional | App functionality   |
| App interactions      | No        | No     | —        | (no analytics)      |
| Device or other IDs   | No        | No     | —        | (no advertising)    |

Third parties:
- **Open Food Facts** — receives barcode only on lookup. No PII.
- **UPCitemdb** — receives barcode only on lookup. No PII.
- **Expo Push** — receives device push token + notification payload (item name + expiry). No PII beyond token.

## App access

Sign-in required → provide demo account: `appreview@pantry.example` / password from 1Password.

## Privacy Policy

URL: https://pantry.example/privacy (must be live before submission; mirror of `/docs/legal/privacy-policy.md`).

## Release tracks

1. **Internal testing** — up to 100 testers, no review, instant
   - Set up tester list: add team emails
2. **Closed testing** — open to wider beta group via email opt-in
3. **Open testing** — public beta, anyone with link can install
4. **Production** — public

## Upload + release

```bash
cd apps/mobile
eas build --profile production --platform android
# When build finishes:
eas submit --profile production --platform android
# Defaults to internal track per eas.json
```

Then in Play Console:
1. **Internal testing → Releases → Promote to closed testing**
2. After 2 weeks soak: **Promote to production**, set rollout to 10%
3. Monitor `/admin/system/api-errors` and Play Console vitals for 48h
4. If green: ramp to 50%, then 100%

## Common rejection causes

- Permissions without rationale in description → mention camera + notifications usage
- Privacy Policy URL returns 404 → double-check it's deployed
- Target SDK < 34 → upgrade
- Missing Data safety form → fill before submitting
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/docs/android-submission.md
git commit -m "docs(mobile): Android Play Store submission runbook"
```

---

## Phase H — Legal text (privacy + terms)

### Task H1: Privacy policy

**Files:**
- Create: `docs/legal/privacy-policy.md`

- [ ] **Step 1: Write the full policy**

```markdown
# Pantry Privacy Policy

**Effective date:** 2026-06-01
**Last updated:** 2026-06-01

This Privacy Policy explains what data Pantry ("we", "us") collects, how we use it, and the choices you have. Pantry is a self-hosted personal pantry tracker. We do not sell your data. We do not embed third-party analytics.

## 1. Information we collect

### 1.1 Information you provide

- **Account information:** email address, password (stored as an argon2 hash), and optionally first name, last name, country, and avatar image.
- **Pantry records:** items you add (name or scanned product, quantity, expiry date, optional photo, optional notes). These are private to your account.
- **Reviews and votes:** ratings (1–5 stars) and optional written reviews you submit on products, plus your upvotes and downvotes on others' reviews. These are publicly visible alongside your display name.
- **Reports:** if you flag a review, user, or product, we keep the report text for moderation.
- **Communication:** if you contact support, we keep the message you send us.

### 1.2 Information we collect automatically

- **Device information:** platform (iOS / Android), OS version, app version, device model. Used for crash diagnostics and to deliver notifications.
- **Push notification token:** if you grant notification permission, we store the Expo Push token associated with your device so we can send expiry reminders.
- **IP address:** captured on sign-up to auto-detect your country (ISO-3166 alpha-2 code). The raw IP is not stored after lookup; only the derived country code is kept (you can override it in Settings).
- **Session metadata:** timestamps and device info for each active sign-in session, so you can revoke them.
- **Log data:** API request logs (path, status, timing, request ID) retained for 7 days locally for debugging.

### 1.3 Information from third parties

- **Sign in with Google / Apple:** if you choose social sign-in, the provider returns your email and a unique identifier. We store the identifier and email.
- **Open Food Facts** and **UPCitemdb:** when you scan a barcode we don't already have, we look it up at these public catalogs. Only the barcode value is sent. No identifier of you is included.

## 2. How we use information

- Operate the service: sign you in, store your pantry, deliver notifications, show product information, accept and display reviews
- Detect and resolve abuse: profanity-filter new reviews, hold reported content for moderator review
- Communicate with you: email verification, password reset, expiry reminders
- Protect security: rate limit abusive traffic, detect unusual sign-in activity

We do not use your data to train AI models. We do not sell or rent your data. We do not embed advertising networks or third-party analytics SDKs.

## 3. How information is shared

- **Public on the platform:** your display name, reviews, votes, and the products you have created entries for are visible to other Pantry users.
- **Service providers:**
  - **Open Food Facts** / **UPCitemdb** — receive only the barcode value during lookups
  - **Expo Push** (Expo / EAS) — receives your push token and notification payload
  - **S3-compatible object storage** (Backblaze B2 or Cloudflare R2) — receives encrypted backups of the database
- **Legal:** we may disclose information when required by law in the jurisdiction the server is hosted in.

We do not transfer your data to any other third party.

## 4. Data retention

- **Account data:** until you delete your account
- **Pantry records:** until you delete them, or for 90 days after account deletion in encrypted backups
- **Reviews:** retained even after account deletion (anonymized to "[deleted user]") so vote counts on others' reviews remain meaningful. You can delete individual reviews any time.
- **Logs:** 7 days
- **Backups:** rolling 7 daily / 4 weekly / 3 monthly (max 90 days)
- **Sessions:** until expiry (30 days) or until you revoke them

## 5. Your choices

- **Edit your profile** at any time in Settings → Account
- **Revoke a session** in Settings → Security → Active sessions
- **Delete your account** in Settings → Account → Delete account. We soft-delete immediately (no further sign-in) and hard-delete after 30 days.
- **Opt out of notifications** at the OS level or in Settings → Notifications
- **Export your data:** email support and we will provide a JSON export of your records and reviews within 30 days

## 6. Security

- All traffic uses HTTPS (TLS 1.2+)
- Passwords are stored as argon2id hashes
- Refresh tokens are stored as sha256 hashes (never plaintext)
- Database is hosted on a private network and only the API user can read it
- Backups are encrypted with `age` before upload
- Admin access requires a second factor (TOTP) and is restricted by IP allowlist
- We follow the principle of least privilege for all internal access

No system is perfectly secure. If we ever experience a breach affecting your data, we will notify you by email within 72 hours of confirmation.

## 7. Children

Pantry is rated 4+ on iOS and Everyone on Android. We do not knowingly collect data from children under 13. If we learn we have collected such data, we will delete it.

## 8. International users

Our servers are located in the European Union. By using Pantry from outside the EU, you consent to your information being processed in the EU under GDPR-equivalent protections.

## 9. Changes

We may update this policy from time to time. We will notify you in the app of material changes and update the "Last updated" date above.

## 10. Contact

Questions? Email **privacy@pantry.example**.
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/legal
git add docs/legal/privacy-policy.md
git commit -m "docs(legal): publish privacy policy"
```

---

### Task H2: Terms of Service

**Files:**
- Create: `docs/legal/terms.md`

- [ ] **Step 1: Write the full terms**

```markdown
# Pantry Terms of Service

**Effective date:** 2026-06-01
**Last updated:** 2026-06-01

Welcome to Pantry. By creating an account or using the app, you agree to these Terms. If you don't agree, don't use the service.

## 1. Eligibility

You must be at least 13 years old. If you are between 13 and the age of majority in your country, you must have your parent's or guardian's permission.

## 2. Your account

- You are responsible for keeping your password secret. Use a unique password.
- You are responsible for activity under your account. Tell us immediately at **security@pantry.example** if you believe your account has been compromised.
- One person, one account. Do not impersonate anyone.

## 3. Acceptable use

You agree not to:

- Submit reviews that are spammy, abusive, defamatory, or contain personal information about others
- Use the app to harass, threaten, or stalk anyone
- Attempt to reverse engineer the app or access the API outside the published endpoints
- Scrape, mirror, or republish other users' content without permission
- Submit barcodes or product entries solely to manipulate ratings
- Circumvent rate limits or abuse the service in a way that degrades it for others

We may suspend or terminate accounts that violate these rules. Severe violations may be reported to law enforcement.

## 4. Your content

You retain ownership of the records, reviews, votes, and other content you submit. By submitting content, you grant Pantry a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display it for the sole purpose of operating the service. This license ends when you delete the content (with the caveat in §4 of the Privacy Policy: reviews remain visible as `[deleted user]` to preserve vote integrity).

## 5. Our content

The Pantry app, including its design, code, themes, and trademarks, is owned by the operator and protected by copyright. You may not copy or redistribute it without permission.

## 6. Third-party data

Product information may come from **Open Food Facts** (Open Database License) and **UPCitemdb**. We display it for your convenience; we do not warrant its accuracy. Expiry dates are a planning aid, not a food-safety guarantee.

## 7. Disclaimers

The service is provided **"as is" and "as available"**. Pantry is a personal pantry tracker. It is not medical advice, food-safety advice, or nutritional advice. Always trust your senses and labels before consuming food.

To the extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.

## 8. Limitation of liability

To the extent permitted by law, the operator's total liability for any claim arising from your use of Pantry is limited to the amount you paid for the service in the 12 months preceding the claim (which is $0 for the free tier).

We are not liable for indirect, incidental, consequential, or punitive damages — including, without limitation, lost data, missed reminders, or food spoilage.

## 9. Termination

You may delete your account any time in Settings → Account → Delete. We may suspend or terminate your account if you violate these Terms, with or without notice.

## 10. Changes

We may update these Terms. Material changes will be announced in the app at least 14 days before they take effect. Continued use after the effective date is your acceptance.

## 11. Governing law

These Terms are governed by the laws of the jurisdiction the operator is registered in, without regard to conflict-of-laws principles. Disputes will be resolved in the courts of that jurisdiction.

## 12. Contact

Questions? **legal@pantry.example**.
```

- [ ] **Step 2: Commit**

```bash
git add docs/legal/terms.md
git commit -m "docs(legal): publish terms of service"
```

---

## Phase I — Operational runbooks

### Task I1: Restore drill runbook

**Files:**
- Create: `docs/runbooks/restore-drill.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Restore drill runbook

**Cadence:** Quarterly (1st of Jan / Apr / Jul / Oct). Add to operator calendar.

**Purpose:** prove the backup pipeline produces a usable Postgres snapshot. A backup you have never restored is not a backup.

**Estimated time:** 60 minutes operator + 30 min compute.

## Prerequisites

- Scratch VPS available (same provider class as prod, e.g., Hetzner CX22). Provision and tear down per drill — do not keep it standing.
- SSH key for the operator account loaded
- `age` CLI installed locally
- `rclone` installed locally with a working `[b2]` remote configured at `~/.config/rclone/rclone.conf` (read access to `pantry-backups`)
- The `age` recipient private key checked out from 1Password into `~/.config/age/pantry.key` (mode 600)

## Step-by-step

### 1. Provision scratch VPS (5 min)

```bash
# Example: Hetzner Cloud CLI
hcloud server create --type cx22 --image ubuntu-24.04 \
  --name pantry-restore-drill-$(date +%Y%m%d) \
  --ssh-key operator
# Note the assigned IP, export it:
export DRILL_IP=<ip>
```

### 2. Install Postgres on the scratch host (5 min)

```bash
ssh root@$DRILL_IP
apt update && apt install -y postgresql-16 age
systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE ROLE pantry_app LOGIN PASSWORD 'drilldrilldrill';"
sudo -u postgres psql -c "CREATE DATABASE pantry OWNER pantry_app;"
exit
```

### 3. Download the most recent daily backup (5 min)

```bash
# On your laptop
rclone lsf b2:pantry-backups/daily/ | sort | tail -5
# Pick the latest, e.g., 2026-05-23.age
rclone copy b2:pantry-backups/daily/2026-05-23.age /tmp/
mv /tmp/2026-05-23.age ./drill.dump.age
```

### 4. Decrypt locally (1 min)

```bash
age -d -i ~/.config/age/pantry.key -o drill.dump drill.dump.age
ls -lh drill.dump
# Expected: a non-zero-size .dump file in Postgres custom format
```

### 5. Copy to scratch host + restore (10 min)

```bash
scp drill.dump root@$DRILL_IP:/tmp/
ssh root@$DRILL_IP \
  "sudo -u postgres pg_restore -d pantry --clean --if-exists --no-owner --role=pantry_app /tmp/drill.dump"
```

Expected: pg_restore prints object counts; exit code 0. Some "already exists" warnings are normal during `--clean`.

### 6. Verify row counts (10 min)

Capture prod row counts beforehand. From your laptop with prod read-only access:

```bash
ssh pantryapp@prod-host \
  "sudo -u postgres psql -d pantry -At -c \"SELECT 'users', count(*) FROM users UNION ALL \
                                            SELECT 'records', count(*) FROM records UNION ALL \
                                            SELECT 'reviews', count(*) FROM reviews UNION ALL \
                                            SELECT 'review_votes', count(*) FROM review_votes UNION ALL \
                                            SELECT 'products', count(*) FROM products;\"" \
  > prod-counts.txt
```

Then on the scratch host:

```bash
ssh root@$DRILL_IP \
  "sudo -u postgres psql -d pantry -At -c \"SELECT 'users', count(*) FROM users UNION ALL \
                                            SELECT 'records', count(*) FROM records UNION ALL \
                                            SELECT 'reviews', count(*) FROM reviews UNION ALL \
                                            SELECT 'review_votes', count(*) FROM review_votes UNION ALL \
                                            SELECT 'products', count(*) FROM products;\"" \
  > drill-counts.txt
```

Compare:

```bash
diff prod-counts.txt drill-counts.txt
```

**Pass criteria:** every count matches prod within ±10 rows (allowing for drift between the backup window and the prod read).

### 7. Spot-check application data (5 min)

```bash
ssh root@$DRILL_IP "sudo -u postgres psql -d pantry -c \"SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 3;\""
```

Expect: 3 recent users, no NULL emails, plausible timestamps.

### 8. Tear down scratch VPS (1 min)

```bash
hcloud server delete pantry-restore-drill-$(date +%Y%m%d)
shred -u drill.dump drill.dump.age
```

### 9. Record the drill

Append a line to `docs/runbooks/restore-drill-log.md`:

```
| YYYY-MM-DD | <operator> | <backup file> | PASS/FAIL | notes |
```

## If anything fails

- **Backup file missing in S3:** investigate `backup.sh` logs on prod under `/var/log/pantry/backup.log`. Re-run `infra/scripts/backup.sh` manually.
- **age decryption fails:** the recipient key has rotated and the backup was made under the old key. Recover the old key from 1Password (we keep the previous 2 generations). Schedule a re-encryption pass.
- **pg_restore errors:** capture the full output. Check that scratch Postgres version matches prod (both 16). Re-run with `--verbose`.
- **Row counts differ wildly:** treat this as a P1 incident. The backup pipeline is producing partial dumps. Page on-call.
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/runbooks
git add docs/runbooks/restore-drill.md
git commit -m "docs(infra): quarterly restore drill runbook"
```

---

### Task I2: Rollback runbook

**Files:**
- Create: `docs/runbooks/rollback.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Deploy rollback runbook

**When to use:** the latest deploy is causing user-visible errors, elevated 5xx, or failing smoke tests.

**RTO target:** < 5 minutes from decision to "rollback complete".

## Prerequisites

- SSH access to the prod host as `pantryapp` (key in 1Password)
- Knowledge of the previous good SHA — find via GitHub Actions runs on `main` filtered to "success"

## 1. Identify the last good SHA (30 seconds)

Open https://github.com/pantry-org/pantry/actions?query=branch%3Amain+is%3Asuccess. Note the SHA from the deploy job that was green before the bad one.

Alternatively on the host:

```bash
ssh pantryapp@prod-host
ls -1 /opt/pantry/releases/ | sort | tail -5
readlink /opt/pantry/current
```

The directory above the current symlink target is your rollback target.

## 2. Swap the symlink (10 seconds)

```bash
LAST_GOOD=<sha>
ln -sfn /opt/pantry/releases/$LAST_GOOD /opt/pantry/current
```

## 3. Restart services (10 seconds)

```bash
sudo systemctl restart pantry-api pantry-admin
```

`systemctl restart` sends `SIGTERM` to each unit; the units stop with `TimeoutStopSec=30`, giving the in-flight handler in `api/src/server.ts` its graceful drain window before SIGKILL. Active requests complete; new requests use the rolled-back binary. (`reload` is a no-op for these `Type=simple` units — they have no `ExecReload`.)

## 4. Smoke test (30 seconds)

```bash
curl -fsS https://api.pantry.example/health/ready
# Expected: {"status":"ok","db":true,"redis":true}

curl -fsS https://api.pantry.example/v1/products/search?q=milk -H "Authorization: Bearer <test-token>"
# Expected: 200 with results array
```

## 5. Watch error rate (5 minutes)

Tail logs:

```bash
sudo journalctl -u pantry-api -f --since "1 minute ago" | grep -E '"level":(40|50)'
```

Expected: error rate drops back to baseline within 60 seconds. If not, you rolled back to a SHA that's also broken — try one further back.

## 6. Announce

- Post in #incidents: "Rolled back pantry-api + pantry-admin to <sha>. Smoke tests green."
- Open a ticket to investigate root cause of the bad deploy. Block re-deploy of the bad SHA.

---

## Prisma migration rollback

**Prisma does not auto-rollback.** A migration that ran successfully is now in `_prisma_migrations`. Reverting to a previous SHA without reverting the schema means the old code may read columns that don't exist (rare, since we additive-only) or — worse — be missing columns that already do exist (common).

### Decision tree

1. **Was the bad deploy migration-additive only (new columns/tables, no destructive changes)?**
   The old code ignores the new columns. Safe to symlink-rollback only. The next deploy will simply not need to re-apply.

2. **Did the bad deploy drop or rename a column the old code reads?**
   Restore from the most recent backup (or from a logical backup snapshot taken pre-migration). See "Restore subset" below.

3. **Did the bad deploy modify data (a backfill went wrong)?**
   You have two options:
   - **Forward fix:** write a corrective migration and re-deploy. Preferred for small blast radius.
   - **PITR-like restore:** restore the most recent pre-incident backup into a parallel schema, write a SQL diff to copy corrected rows back. See below.

### Restore a single table from backup

```bash
# On the prod host:
ssh pantryapp@prod-host
# Pull the most recent pre-incident dump
rclone copy b2:pantry-backups/daily/2026-05-23.age /tmp/
mv /tmp/2026-05-23.age /tmp/backup.dump.age
age -d -i ~/.config/age/pantry.key -o /tmp/backup.dump /tmp/backup.dump.age

# Restore one table into a recovery schema
sudo -u postgres psql -d pantry -c "CREATE SCHEMA recovery;"
sudo -u postgres pg_restore -d pantry --schema=public --table=records \
  --no-owner --use-set-session-authorization \
  /tmp/backup.dump | sed 's/public\.records/recovery.records/g' | sudo -u postgres psql -d pantry

# Inspect, then copy good rows back
sudo -u postgres psql -d pantry -c "
  BEGIN;
  UPDATE public.records p
  SET col = r.col
  FROM recovery.records r
  WHERE p.id = r.id AND <condition>;
  COMMIT;
"
```

After recovery: `DROP SCHEMA recovery CASCADE;` and `shred -u /tmp/backup.dump*`.

## 7. Postmortem

Within 48 hours, write a postmortem in `docs/postmortems/YYYY-MM-DD-<short-name>.md`. Use the template in `docs/runbooks/incident-response.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/rollback.md
git commit -m "docs(infra): deploy rollback runbook with Prisma considerations"
```

---

### Task I3: Revoke-all-sessions runbook

**Files:**
- Create: `docs/runbooks/revoke-all-sessions.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Revoke all sessions runbook

**When to use:** credential compromise of the JWT signing key, suspected mass account takeover, or an emergency where you need every user to re-authenticate immediately.

**Side effect:** every active user is signed out across all devices. Push notification tokens remain valid (they don't expire by the same mechanism).

**Estimated time:** 5 minutes.

## 1. Mark every session revoked (DB)

```bash
ssh pantryapp@prod-host
sudo -u postgres psql -d pantry <<'SQL'
BEGIN;
UPDATE sessions
SET revoked_at = NOW()
WHERE revoked_at IS NULL;
SELECT count(*) AS revoked FROM sessions WHERE revoked_at >= NOW() - INTERVAL '1 minute';
COMMIT;
SQL
```

Expected: the printed `revoked` count is in the ballpark of active sessions. This invalidates every refresh-token row.

## 2. Force-rotate the JWT signing key

The access token (15 min lifetime) is signed with the key in `JWT_ACCESS_SECRET`. After step 1, refresh fails immediately, but a stolen access token is still valid until expiry. Rotating the signing key kills active access tokens too.

```bash
# Generate a new key
NEW=$(openssl rand -base64 64 | tr -d '\n')
# Edit the env file
sudo -i
nano /etc/pantry/.env.production
# Set: JWT_ACCESS_SECRET=<NEW>
# Save, exit
systemctl restart pantry-api pantry-admin All access tokens signed under the old key fail verification immediately and every client must re-authenticate.
>
> **Future enhancement:** implement a previous-key grace mechanism (e.g., `JWT_ACCESS_SECRET_PREVIOUS`) for zero-downtime JWT rotation. Not in v1.

## 3. Verify

```bash
# Existing token must now fail:
curl -i https://api.pantry.example/v1/auth/me -H "Authorization: Bearer <old-token>"
# Expected: 401 Unauthorized

# New sign-in must work:
curl -i https://api.pantry.example/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"appreview@pantry.example","password":"<demo>"}'
# Expected: 200 with new tokens
```

## 4. Communicate

Post to status page and in-app banner. Use the admin UI or PATCH the feature flag directly with the Zod-validated body shape:

```bash
curl -X PATCH https://admin.pantry.example/api/feature-flags \
  -H "Content-Type: application/json" \
  -d '{ "maintenanceBanner": "For security reasons we have signed everyone out. Please sign in again. Your data is unaffected." }'
```

Set `maintenanceBanner: null` to clear.

## 5. Audit

Append to `admin_audit_log` via the admin UI (auto-logged when an admin runs the maintenance action) **or** insert manually:

```sql
INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, diff, ip)
VALUES ('<your-admin-uuid>', 'sessions.revoke_all', 'system', 'all',
        '{"reason":"<short-reason>"}'::jsonb, '127.0.0.1');
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/revoke-all-sessions.md
git commit -m "docs(infra): revoke-all-sessions emergency runbook"
```

---

### Task I4: Rotate-secrets runbook

**Files:**
- Create: `docs/runbooks/rotate-secrets.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Rotate secrets runbook

**Cadence:** annual + on any suspected compromise.

**Inventory** (in `/etc/pantry/.env.production`):

- `JWT_ACCESS_SECRET` (HS256 signing key for access tokens)
- `DATABASE_URL` password (the `pantry_app` Postgres role)
- `REDIS_URL` (full URL incl. password: `redis://[:password@]localhost:6379`)
- `BACKUP_AGE_RECIPIENT` (age public recipient string for encrypting backups)
- B2 application key (used by `rclone` to upload backups; lives in `~/.config/rclone/rclone.conf` for the `pantryapp` user, NOT in `.env.production`)
- `SMTP_PASSWORD`
- `EXPO_ACCESS_TOKEN` (push delivery)
- `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_APPLE_PRIVATE_KEY`

All edits to `/etc/pantry/.env.production` are followed by `systemctl restart pantry-api pantry-admin` (these `Type=simple` units have no `ExecReload`, so a `reload` would be a silent no-op; restart sends SIGTERM and lets the process drain within `TimeoutStopSec=30`).

## JWT signing key

1. Generate: `openssl rand -base64 64`
2. Set the new value as `JWT_ACCESS_SECRET` in `/etc/pantry/.env.production`
3. `systemctl restart pantry-api pantry-admin`
4. **All sessions are forced to re-authenticate.** This is a hard cutover in v1.

> **Future enhancement:** implement a previous-key grace period (e.g., `JWT_ACCESS_SECRET_PREVIOUS` accepted on verify only) for zero-downtime JWT rotation. For v1, all sessions are forced to re-auth after rotation.

## Postgres `pantry_app` password

1. Generate new password: `openssl rand -base64 32`
2. Update Postgres:
   ```sql
   ALTER ROLE pantry_app WITH PASSWORD '<new>';
   ```
3. Update `DATABASE_URL` in `.env.production`
4. `systemctl restart pantry-api pantry-admin`
5. Verify: `curl https://api.pantry.example/health/ready` returns `db: true`

## Redis password

1. Generate: `openssl rand -base64 32`
2. Edit `/etc/redis/redis.conf` → `requirepass <new>`
3. Edit `/etc/pantry/.env.production` → `REDIS_URL=redis://:<new>@localhost:6379`
4. `systemctl restart redis-server pantry-api`
5. Verify: `curl https://api.pantry.example/health/ready` returns `redis: true`

## Backblaze B2 application key (used by rclone)

1. In the Backblaze B2 console, create a new application key scoped to the `pantry-backups` bucket (RW)
2. Update the credentials in `~/.config/rclone/rclone.conf` under the `[b2]` remote section:
   ```ini
   [b2]
   type = b2
   account = <new-key-id>
   key = <new-application-key>
   ```
3. Test: `rclone lsf b2:pantry-backups/`
4. Trigger a manual backup: `sudo -u pantryapp /opt/pantry/current/infra/scripts/backup.sh`
5. Confirm a new file lands at `b2:pantry-backups/daily/$(date -u +%Y-%m-%d).age`
6. Revoke the old application key in the B2 console

## age backup recipient

1. Generate new keypair on a workstation: `age-keygen -o pantry-age-$(date +%Y%m%d).key`
2. The output file contains both the secret key and the public recipient (`# public key: age1...`).
3. Update `BACKUP_AGE_RECIPIENT` in `/etc/pantry/.env.production` to the new `age1...` recipient string
4. `systemctl restart pantry-api`
5. Store the new private key in 1Password under "Pantry Backups → Age key (current)". Move the previous one to "Age key (N-1)". Keep two generations so that historic backups under the old recipient can still be decrypted during a restore drill.
6. After the next quarterly restore drill passes with the new key, the old generation may be archived but never deleted while any backups encrypted under it still exist.

## SMTP password

1. Rotate at the SMTP provider (e.g., Postmark / SES)
2. Update `SMTP_PASSWORD`, restart
3. Send a test verification email to your own address

## Expo access token

1. https://expo.dev/accounts/<org>/settings/access-tokens → revoke old, create new
2. Update `EXPO_ACCESS_TOKEN`, reload
3. Trigger a test push from `/admin/system/push-logs → send test`

## OAuth client secrets

1. Google Cloud Console → APIs & Services → Credentials → rotate
2. Apple Developer → Keys → revoke key, generate new, download .p8
3. Update `OAUTH_GOOGLE_CLIENT_SECRET` and `OAUTH_APPLE_PRIVATE_KEY`
4. Reload services
5. Test sign-in from a clean device

## Verify after each rotation

```bash
curl -fsS https://api.pantry.example/health/ready
# Expected: {"status":"ok","db":true,"redis":true}
sudo journalctl -u pantry-api --since "2 minutes ago" | grep -i error
# Expected: no auth/connection errors
```

## Record the rotation

Append to `docs/runbooks/secret-rotation-log.md`:

```
| YYYY-MM-DD | <operator> | <secret name> | reason |
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/rotate-secrets.md
git commit -m "docs(infra): annual secrets rotation runbook"
```

---

### Task I5: Incident response runbook

**Files:**
- Create: `docs/runbooks/incident-response.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Incident response runbook

A lightweight playbook for a one-operator service. Use it the moment you suspect impact.

## Severity definitions

| Sev | Definition                                                            | Response time |
|-----|-----------------------------------------------------------------------|---------------|
| S1  | Total outage. /health failing. Data loss confirmed or suspected.      | Immediate     |
| S2  | Partial outage. Sign-in broken, scan broken, or push notifications stopped. | < 1 hour      |
| S3  | Single feature degraded. UI bug. Slow but functional.                  | Same day      |
| S4  | Cosmetic / single-user.                                                | Backlog       |

## Phases

### 1. Declare

- Post in #incidents Slack/Discord with `[INC YYYY-MM-DD-NN] S<n>: <one-line summary>`
- Open a ticket; this is your scratchpad and the seed for the postmortem
- If S1/S2: enable the maintenance banner via `/admin/settings/feature-flags → maintenanceBanner = "We are investigating an issue. Updates at status.pantry.example."` (string value; set `null` to clear). The PATCH body shape is `{ "maintenanceBanner": "..." }`, Zod-validated against M3's `feature_flags` seed.

### 2. Triage (first 15 min)

- What changed recently? Check the latest deploy SHA: `readlink /opt/pantry/current`
- Is `/health/ready` returning ok?
- Are DB and Redis up? `systemctl status postgresql redis-server`
- Tail logs: `sudo journalctl -u pantry-api -f --since "10 minutes ago"`
- Check `/admin/system/queue-health` and `/admin/system/api-errors`
- If recent deploy + symptoms started right after: ROLLBACK first, investigate second (see `rollback.md`)

### 3. Comms

**Internal:** keep #incidents updated every 15 min until resolved. Format: `[INC ...] status update — what we know, what we are doing, ETA`.

**External:**

- Update the status page (Statuspage-lite at `https://status.pantry.example`). Post: investigating → identified → monitoring → resolved.
- For S1/S2 with > 30 min impact, email affected users from the operator inbox using this template:

  ```
  Subject: Pantry — service disruption update

  Hi,

  Between <start UTC> and <end UTC>, Pantry was <briefly degraded / unavailable / unable to deliver push notifications>.
  We have identified the cause as <one sentence, plain language> and the service has been restored.

  Your data is safe. <If true: No records or reviews were lost.>

  We are sorry for the disruption.

  — The Pantry team
  ```

### 4. Mitigate

- Apply the smallest change that restores service. Roll back > patch > config > restart > escalate.
- Do not chase root cause during mitigation. Capture clues; analyze afterwards.

### 5. Resolve

- Confirm: smoke tests pass, error rate normal for 10 consecutive minutes, queue depth healthy
- Update status page to "resolved"
- Disable maintenance banner

### 6. Postmortem (within 48h)

Save as `docs/postmortems/YYYY-MM-DD-<slug>.md`:

```markdown
# Postmortem: <short title>

**Date:** YYYY-MM-DD
**Severity:** S<n>
**Duration:** HH:MM (UTC <start> → UTC <end>)
**Author:** <operator>

## Summary
One paragraph anyone can understand.

## Impact
- Users affected: <number / percentage>
- Features affected: <list>
- Data loss: <none / scope>

## Timeline (UTC)
- HH:MM — first symptom
- HH:MM — incident declared
- HH:MM — root cause identified
- HH:MM — fix applied
- HH:MM — resolved

## Root cause
Plain-language explanation. Include the offending commit/config/query.

## What went well
- ...

## What went poorly
- ...

## Action items
- [ ] <owner> <due date> — <action>
- [ ] <owner> <due date> — <action>
```

Action items go into the backlog with the postmortem URL attached. Review at the next quarterly ops review.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/incident-response.md
git commit -m "docs(infra): incident response playbook + postmortem template"
```

---

### Task I6: Uptime monitoring runbook

**Files:**
- Create: `docs/runbooks/uptime-monitoring.md`

- [ ] **Step 1: Write the runbook in full**

```markdown
# Uptime monitoring runbook

Goal: be paged within 5 minutes of `/health` failing.

## Provider

**UptimeRobot** (free tier covers our two monitors at 5-min interval).

## Monitors

1. **API liveness** — HTTPS GET `https://api.pantry.example/health` every 5 min, expect 200
2. **API readiness** — HTTPS GET `https://api.pantry.example/health/ready` every 5 min, expect 200 AND `db:true` AND `redis:true` (use "keyword exists" check)
3. **Admin landing** — HTTPS GET `https://admin.pantry.example/login` every 5 min, expect 200

## Alert contacts

### Primary: email

Add `ops@pantry.example` (forwards to operator personal email + on-call phone via Gmail filter).

### Secondary: choose one of Telegram or Discord

**Telegram (recommended for a one-operator service):**

1. Open Telegram, message `@BotFather`, run `/newbot`, name it `PantryAlertBot`
2. Save the bot token
3. Create a private channel `Pantry Alerts`, add the bot as admin
4. Get the channel ID:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].channel_post.chat.id'
   ```
5. In UptimeRobot → My Settings → Alert Contacts → Add → Telegram
   - Chat ID: `<from step 4>`
   - Token: `<from step 2>`
6. Test by toggling a monitor off and back on

**Discord (alternative):**

1. In your Discord server: Server Settings → Integrations → Webhooks → New Webhook → `#pantry-alerts`
2. Copy webhook URL
3. UptimeRobot → Alert Contacts → Add → Webhook
   - URL: `<webhook URL>?wait=true`
   - POST value: `{"content":"*alertTypeFriendlyName*: *monitorFriendlyName* — *alertDetails*"}`
   - Content-Type: `application/json`
4. Test by toggling a monitor

## Escalation

| Time since alert | Action                                                          |
|------------------|-----------------------------------------------------------------|
| 0 min            | Email + Telegram fire                                           |
| 10 min           | UptimeRobot re-sends if still down                              |
| 30 min           | Operator SMS via fallback (UptimeRobot Pro, or self-hosted cron) |

## On-call rotation

Single operator for now. Future: add a secondary, rotate weekly via Google Calendar.

## False-positive handling

- Two consecutive 5-min failures = real
- Single transient failure (network blip) = log only

Configure in UptimeRobot → Monitor → Advanced Settings → "Alert after N occurrences" = 2.

## Maintenance windows

Schedule planned maintenance windows in UptimeRobot to suppress alerts:
UptimeRobot → Maintenance Windows → Add → set start/end UTC.

## Quarterly drill

Once per quarter:

1. Disable the API briefly (`sudo systemctl stop pantry-api`)
2. Confirm alert lands within 5 minutes on every channel
3. Re-enable: `sudo systemctl start pantry-api`
4. Confirm UptimeRobot status returns to "up"

Log the drill in `docs/runbooks/uptime-drill-log.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/uptime-monitoring.md
git commit -m "docs(infra): UptimeRobot setup with Telegram + Discord alternatives"
```

---

## Phase J — Security review + soft launch + release checklist

### Task J1: Security review checklist

**Files:**
- Create: `docs/runbooks/security-review.md`

- [ ] **Step 1: Write the checklist in full**

```markdown
# Security review checklist

Run before first launch, then quarterly. Every item has a command + expected output. Tick only after the command passes.

## TLS / nginx

- [ ] **HSTS header present**
  ```bash
  curl -sI https://api.pantry.example/health | grep -i strict-transport-security
  # Expected: strict-transport-security: max-age=31536000; includeSubDomains; preload
  ```

- [ ] **TLS 1.2+ only (TLS 1.0/1.1 disabled)**
  ```bash
  nmap --script ssl-enum-ciphers -p 443 api.pantry.example | grep -E 'TLSv1\.[01]'
  # Expected: no output (no TLS 1.0/1.1 lines)
  ```

- [ ] **Request body size cap enforced (1 MB default; 5 MB on avatar upload route)**
  ```bash
  head -c 6000000 /dev/urandom | base64 | curl -sI -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" --data-binary @-
  # Expected: 413 Payload Too Large
  ```

- [ ] **Rate limit fires on /v1/auth/***
  ```bash
  for i in $(seq 1 15); do curl -sI -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'; done | grep -c '429'
  # Expected: at least 5 (default limit is 10/min/IP per spec §6.8)
  ```

## Postgres

- [ ] **Localhost only**
  ```bash
  ssh pantryapp@prod-host "sudo ss -tlnp | grep ':5432'"
  # Expected: only 127.0.0.1:5432, no 0.0.0.0:5432
  ```

- [ ] **App user has no superuser**
  ```bash
  ssh pantryapp@prod-host "sudo -u postgres psql -At -c \"SELECT rolsuper FROM pg_roles WHERE rolname='pantry_app';\""
  # Expected: f
  ```

- [ ] **Read-only role exists for ad-hoc queries**
  ```bash
  ssh pantryapp@prod-host "sudo -u postgres psql -At -c \"SELECT 1 FROM pg_roles WHERE rolname='pantry_ro';\""
  # Expected: 1
  ```

## ufw + fail2ban

- [ ] **ufw allows only 22, 80, 443**
  ```bash
  ssh pantryapp@prod-host "sudo ufw status numbered"
  # Expected: lines for 22, 80, 443 ALLOW; everything else default deny
  ```

- [ ] **fail2ban active on ssh**
  ```bash
  ssh pantryapp@prod-host "sudo fail2ban-client status sshd"
  # Expected: Currently banned: <some int>, Total banned: <some int>
  ```

## Secrets

- [ ] **`/etc/pantry/.env.production` is mode 600 owned by pantryapp**
  ```bash
  ssh pantryapp@prod-host "stat -c '%a %U:%G' /etc/pantry/.env.production"
  # Expected: 600 pantryapp:pantryapp
  ```

- [ ] **No secrets in logs (grep the journal for env var values)**
  ```bash
  # Pick one safe sentinel from the env file, e.g., first 8 chars of JWT key
  ssh pantryapp@prod-host "sudo journalctl -u pantry-api --since '1 day ago' | grep -F '<sentinel>' | head"
  # Expected: empty output
  ```

## Admin

- [ ] **Admin nginx vhost enforces IP allowlist**
  ```bash
  curl -sI https://admin.pantry.example/login
  # Expected from a non-allowlisted IP: 403
  # Expected from an allowlisted IP: 200
  ```

- [ ] **TOTP required for admin accounts**
  ```bash
  curl -s -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@pantry.example","password":"<correct>"}' | jq .requiresTotp
  # Expected: true (login response uses camelCase `requiresTotp` per the API contract)
  ```

- [ ] **Admin audit log is append-only (no UPDATE/DELETE grants)**
  ```bash
  ssh pantryapp@prod-host "sudo -u postgres psql -d pantry -At -c \"
    SELECT privilege_type FROM information_schema.role_table_grants
    WHERE grantee='pantry_app' AND table_name='admin_audit_log';
  \""
  # Expected: only SELECT, INSERT (no UPDATE, no DELETE)
  ```

## Dependencies

- [ ] **`pnpm audit` shows no high/critical vulnerabilities**
  ```bash
  pnpm audit --audit-level=high
  # Expected: "No known vulnerabilities found"
  ```

- [ ] **Renovate bot is enabled and producing PRs**
  Check https://github.com/pantry-org/pantry/pulls?q=is%3Apr+author%3Arenovate
  Expected: at least one PR in the last 30 days

## Mobile

- [ ] **App talks only to api.pantry.example**
  ```bash
  grep -RIn 'http://\|https://' apps/mobile/src | grep -v 'api.pantry.example\|expo.dev\|openfoodfacts\|upcitemdb'
  # Expected: empty
  ```

- [ ] **Tokens stored in expo-secure-store, not AsyncStorage**
  ```bash
  grep -RIn 'AsyncStorage' apps/mobile/src/auth
  # Expected: empty
  ```

## Sign-off

- Reviewer: _______
- Date: _______
- Outstanding items: _______
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/security-review.md
git commit -m "docs(infra): security review checklist with exact verification commands"
```

---

### Task J2: Soft launch checklist

**Files:**
- Create: `docs/runbooks/soft-launch.md`

- [ ] **Step 1: Write the checklist in full**

```markdown
# Soft launch checklist

A 14-day staged launch to keep blast radius small while real users exercise the system.

## T-7 days: pre-launch

- [ ] All M0–M4 plans complete; `git tag m4-complete` set
- [ ] Most recent restore drill PASSED within the last 30 days (see `restore-drill.md`)
- [ ] `infra/scripts/backup.sh` is on a daily cron under `pantryapp`, last 7 backups present in S3
- [ ] `infra/scripts/restore.sh` tested in the drill
- [ ] Every runbook in `docs/runbooks/` reviewed end-to-end by the operator
- [ ] Security review checklist (`security-review.md`) green
- [ ] Status page live at `https://status.pantry.example` with all monitors green
- [ ] UptimeRobot monitors firing; quarterly drill scheduled
- [ ] Privacy policy + terms live at the URLs given in `ios-submission.md` / `android-submission.md`
- [ ] Demo App Review account `appreview@pantry.example` provisioned, password in 1Password
- [ ] Apple Sign In and Google Sign In tested end-to-end on TestFlight build
- [ ] Push notification delivered end-to-end on TestFlight build
- [ ] Manual a11y checklist passed on TestFlight + Play Internal builds
- [ ] CI green on `main`

## T-1 day

- [ ] Tag release: `git tag v1.0.0 && git push --tags`
- [ ] Submit iOS build for App Review (`eas submit --profile production --platform ios`)
- [ ] Promote Android internal → closed testing for the beta cohort
- [ ] Pre-write the launch announcement (in-app banner + Telegram channel + Twitter post)

## Launch day

### Morning

- [ ] Confirm App Store status: "Ready for Sale" (or "Pending Developer Release" if you scheduled it)
- [ ] Promote Android closed → production rollout 10%
- [ ] Smoke test from a fresh device with a fresh account:
  - [ ] Sign up via email + password → email arrives → verify → home
  - [ ] Sign up via Google → home
  - [ ] Sign up via Apple → home
  - [ ] Scan a barcode → lookup hits OFF → save record → home shows it
  - [ ] Review a product → submit → review visible
  - [ ] Vote on someone else's review → count increments
  - [ ] Switch theme: Aurora → Bento → Clay → Material → back to Aurora
  - [ ] Sign out → sign back in
- [ ] Watch `/admin/system/api-errors` — should stay near zero
- [ ] Watch `/admin/system/queue-health` — depth should stay near zero
- [ ] Watch `journalctl -u pantry-api -f` for unusual error patterns
- [ ] Post launch announcement

### Afternoon

- [ ] Spot-check sign-up funnel: how many users completed verification?
  ```sql
  SELECT
    count(*) FILTER (WHERE created_at::date = current_date) AS signups_today,
    count(*) FILTER (WHERE email_verified_at::date = current_date) AS verified_today
  FROM users;
  ```
- [ ] Spot-check scan funnel: how many records created today?
  ```sql
  SELECT count(*) FROM records WHERE created_at::date = current_date;
  ```
- [ ] Bump Android rollout to 50% if no anomalies

### Evening

- [ ] Daily summary in #incidents: signups, scans, reviews, errors
- [ ] Bump Android to 100% if all green for 6 hours

## Day +1

- [ ] Manual spot-check of three random accounts: profile, records, reviews look sane
- [ ] Backup ran overnight: `rclone lsf b2:pantry-backups/daily/ | grep $(date +%Y-%m-%d)`
- [ ] Review yesterday's logs end-to-end for anything unusual
- [ ] Resolve any TestFlight feedback received

## Day +7

- [ ] Cohort analytics: % of D1 signups returning at D7 (use `users.last_seen_at`)
- [ ] Review-volume sanity: any spammers? Run `/admin/reports?status=open`
- [ ] Push delivery success rate: `/admin/system/push-logs` → success / total > 95%
- [ ] Operator self-survey: any runbook gaps discovered? Update them.
- [ ] If all green: scale comms (post to Hacker News, ProductHunt, etc.)

## Day +30

- [ ] Run quarterly restore drill earlier if not already scheduled
- [ ] Review aggregate metrics, plan v1.1
- [ ] Postmortem of the launch in `docs/postmortems/2026-MM-DD-launch.md` — even if uneventful, what went right is worth recording
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/soft-launch.md
git commit -m "docs(infra): soft launch checklist with day 1/7/30 checkpoints"
```

---

### Task J3: Release checklist (gate before every release)

**Files:**
- Create: `docs/runbooks/release-checklist.md`

- [ ] **Step 1: Write the checklist**

```markdown
# Release checklist

Run before every store submission (mobile) or OTA push to `production`. Required as a CI step (`pnpm release:gate`) plus manual verification.

## Automated (CI)

- [ ] `pnpm typecheck` — green across all packages
- [ ] `pnpm lint` — green (includes `eslint-plugin-react-native-a11y`)
- [ ] `pnpm test` — unit + integration green
- [ ] `pnpm test:snapshots` — all per-theme snapshots green
- [ ] Mobile Maestro flows green (sign-in, scan, save record, review, vote, theme-switch)

## Manual

- [ ] Manual screen-reader checklist (`docs/runbooks/../apps/mobile/docs/a11y-manual-checklist.md`) signed off by tester
- [ ] Large-text smoke test on iOS at 200% font scale, no layout breaks beyond documented caps
- [ ] Security review checklist (`security-review.md`) re-run if any infra changed since last release
- [ ] Restore drill PASSED within the last quarter
- [ ] Changelog `CHANGELOG.md` updated for this version
- [ ] Privacy Policy / Terms of Service updated if data practices changed

## Sign-off

- Engineer: _______
- Reviewer: _______
- Version: _______
- Date: _______
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/release-checklist.md
git commit -m "docs(infra): release gate checklist"
```

---

## Phase K — CI wiring

### Task K1: Extend CI with a11y lint + snapshot job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Open the existing workflow and add a new job**

```yaml
  mobile-a11y-and-snapshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: a11y lint (react-native-a11y)
        run: pnpm -C apps/mobile lint
      - name: WCAG contrast tests
        run: pnpm -C apps/mobile test -- contrast
      - name: Per-theme snapshot tests
        run: pnpm -C apps/mobile test -- snapshots
      - name: Touch-target audit
        run: pnpm -C apps/mobile test -- touch-target
```

- [ ] **Step 2: Run the workflow locally with act, or push to a feature branch and verify it runs**

```bash
git checkout -b ci/m4-a11y
git push -u origin ci/m4-a11y
gh run watch
```
Expected: all four steps green.

- [ ] **Step 3: Commit and merge**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(infra): a11y lint + per-theme snapshot job"
```

---

### Task K2: Maestro flow with mid-flow theme switch

**Files:**
- Create: `apps/mobile/maestro/flows/theme-switch.yaml`

- [ ] **Step 1: Write the flow**

```yaml
appId: com.pantry.app
---
- launchApp:
    clearState: true
- tapOn: "Sign in"
- inputText: "appreview@pantry.example"
- tapOn: "Email"   # focus next field
- inputText: "<demo-password>"
- tapOn: "Sign in, button"
- assertVisible: "Your pantry"           # aurora home rendered

# Switch to Bento mid-session
- tapOn: "Profile, tab"
- tapOn: "Settings"
- tapOn: "Theme"
- tapOn: "Use bento theme"
- assertVisible: "Bento"                  # selected marker
- pressKey: Back
- pressKey: Back
- tapOn: "Home, tab"
- assertVisible: "Your pantry"            # home re-renders in bento; tile-based layout

# Switch to Clay
- tapOn: "Profile, tab"
- tapOn: "Settings"
- tapOn: "Theme"
- tapOn: "Use clay theme"
- pressKey: Back
- pressKey: Back
- tapOn: "Home, tab"
- assertVisible: "Your pantry"

# Switch to Material
- tapOn: "Profile, tab"
- tapOn: "Settings"
- tapOn: "Theme"
- tapOn: "Use material theme"
- pressKey: Back
- pressKey: Back
- tapOn: "Home, tab"
- assertVisible: "Your pantry"
```

- [ ] **Step 2: Run against a Maestro-connected device or emulator**

```bash
maestro test apps/mobile/maestro/flows/theme-switch.yaml
```
Expected: all steps green. Iterate if labels don't match (selectors must match the `accessibilityLabel` set in Phase F).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/maestro/flows/theme-switch.yaml
git commit -m "test(mobile): Maestro flow with mid-session theme switch across 4 themes"
```

---

## Phase L — Final verification

### Task L1: Whole-system green check

- [ ] **Step 1: Run everything from clean**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```
Expected: all green.

- [ ] **Step 2: Confirm no leftover hex literals in screens**

```bash
grep -RIn --include='*.tsx' -E '#[0-9a-fA-F]{3,8}\b' apps/mobile/app apps/mobile/src/components | grep -v __snapshots__
```
Expected: empty.

- [ ] **Step 3: Confirm every runbook file exists and is non-empty**

```bash
for f in restore-drill rollback revoke-all-sessions rotate-secrets incident-response uptime-monitoring security-review soft-launch release-checklist; do
  [ -s "docs/runbooks/$f.md" ] && echo "OK  $f" || echo "MISS $f"
done
```
Expected: 9 × `OK`.

- [ ] **Step 4: Confirm every store-submission + a11y doc exists and is non-empty**

```bash
for f in theme-audit build-and-release assets-checklist ios-submission android-submission a11y-manual-checklist; do
  [ -s "apps/mobile/docs/$f.md" ] && echo "OK  $f" || echo "MISS $f"
done
```
Expected: 6 × `OK`.

- [ ] **Step 5: Confirm legal docs exist**

```bash
[ -s docs/legal/privacy-policy.md ] && [ -s docs/legal/terms.md ] && echo OK
```
Expected: `OK`.

- [ ] **Step 6: Tag the milestone**

```bash
git tag m4-complete
git push --tags
```

---

## Self-review

Run against the M4 task list from the prompt.

**Spec coverage:**

| Prompt item | Tasks                  | Status |
|-------------|------------------------|--------|
| 1. Theme audit                 | A1                          | ✓ |
| 2. Token expansion             | A2, A3                      | ✓ |
| 3. Bento Grid theme            | B1, B4, D7                  | ✓ |
| 4. Soft Clay theme             | B2, B5, B6, D7+             | ✓ |
| 5. Material You theme          | B3, B7, D3, D7, D11, D15    | ✓ |
| 6. Theme switch animation      | C1                          | ✓ |
| 7. Theme preview cards         | C2                          | ✓ |
| 8. Per-theme RNTL snapshots    | E1–E8                       | ✓ |
| 9. Contrast audit              | F1 (text 4.5:1 + muted text + border/non-text 3:1) | ✓ |
| 10. a11y labels + lint + touch | F2, F3                      | ✓ |
| 11. Screen reader manual test  | F4                          | ✓ |
| 12. Large text                 | F5                          | ✓ |
| 13. EAS Build profiles         | G1, G4                      | ✓ |
| 14. EAS Update channels        | G2                          | ✓ |
| 15. App icons + splash         | G3                          | ✓ |
| 16. iOS submission prep        | G5                          | ✓ |
| 17. Android submission prep    | G6                          | ✓ |
| 18. Privacy + ToS              | H1, H2                      | ✓ |
| 19. Restore drill              | I1                          | ✓ |
| 20. Rollback runbook           | I2                          | ✓ |
| 21. Revoke-all-sessions        | I3                          | ✓ |
| 22. Rotate-secrets             | I4                          | ✓ |
| 23. Incident response          | I5                          | ✓ |
| 24. UptimeRobot                | I6                          | ✓ |
| 25. Security review            | J1                          | ✓ |
| 26. Soft launch                | J2                          | ✓ |
| 27. Contrast unit tests        | F1 (per-pair thresholds; failing pairs flagged for palette sign-off, no hex changed) | ✓ |
| 28. RNTL snapshot tests        | B4–B7, E1–E8                | ✓ |
| 29. ESLint a11y in CI          | F2, K1                      | ✓ |
| 30. Maestro mid-flow switch    | K2                          | ✓ |
| 31. Release checklist          | J3, K1                      | ✓ |

**Placeholder scan:** searched for "TODO", "TBD", "fill in", "implement later", "add appropriate", "similar to" — none present in plan body. Runbook and store-submission contents are written in full inside the plan.

**Validation amendments (2026-05-26):** (a) Security-review login probe corrected to camelCase `requiresTotp` (was `requires_totp`, which would always read `null`). (b) Contrast test (F1) expanded to cover `text.muted` foregrounds at 4.5:1 and `border`/`accent` non-text boundaries at 3:1; failing pairs (e.g. Bento `text.muted` ≈ #8A8A8A on white) are recorded under a "Palette sign-off required" note rather than silently re-tuned — no user-chosen theme hex was changed.

- **Cross-plan check (M4 self-review #21):** theme token type names match M0a's `Theme` interface (no invented `ThemeTokens`); mobile API base-URL env var matches M0c's `EXPO_PUBLIC_API_BASE_URL`; backup tooling matches M0d (`rclone`, `b2:pantry-backups`); JWT env matches M0a (`JWT_ACCESS_SECRET`); Redis env matches M0a (`REDIS_URL`); feature flag `maintenanceBanner` matches M3's seed.

**Type consistency:** `ClayElevation`, `MD3Elevation`, `TypeRamp`, `TypeRampEntry` defined once in Task A2 and consumed unchanged in A3, B1–B3. `ThemeName` defined in C1 and consumed in C2. Component prop names (`title`, `subtitle`, `onPress`, `accent`, `selected`, `label`, `accessibilityLabel`) are consistent across BentoTile / ClayCard / ClayButton / MD3*. `useThemeSwitcher` exported from `ThemeProvider` in C1, imported in C2. Channel names `development`/`preview`/`production` are consistent between `eas.json` (G1), `app.config.ts` (G2), and the build-and-release runbook (G4). Runbook cross-references (`rollback.md` → `restore-drill.md`, `incident-response.md` → `rollback.md`, `release-checklist.md` → `a11y-manual-checklist.md` + `security-review.md`) all point at files actually created in this plan.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-m4-polish-and-launch.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
