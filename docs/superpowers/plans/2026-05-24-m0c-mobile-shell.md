# M0c — Mobile Shell + Auth + Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Expo mobile app at `apps/mobile/`, wire it into the pnpm + Turborepo monorepo, ship a full mobile-side auth flow against the `/v1/auth/*` and `/v1/me` endpoints built in M0a/M0b, and deliver a working theme provider + switcher covering all four token sets from `@pantry/theme` with Aurora Glass as the polished default.

**Architecture:** Expo SDK (latest stable) with Expo Router for file-based navigation, Zustand stores for client state (auth session, theme, ephemeral UI), TanStack Query for server state, NativeWind 4 for styling via Tailwind tokens hydrated from `@pantry/theme`, `expo-secure-store` for tokens + theme persistence, and a single `fetch`-based API client that injects the access token, refreshes once on 401, and surfaces RFC 7807 errors as typed exceptions. WatermelonDB is NOT installed in M0c; M1 installs it when it builds the offline-first sync engine. Per-screen polished UI ships for Aurora Glass only; the other three themes' surface treatment is M4 — the provider, switcher, and token plumbing work for all four.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript 5, Expo Router 3, Zustand 4, TanStack Query 5, NativeWind 4, Tailwind 3, `expo-secure-store`, `expo-constants`, `expo-linking`, `expo-status-bar`, `expo-blur`, `react-native-reanimated` 3, `react-native-gesture-handler`, `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `react-native-passkey`, Vitest + React Native Testing Library, Maestro (E2E). (WatermelonDB is installed in M1 alongside its models.)

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md` sections 2.1, 2.10, 6.1, 6.6, 7.1, 7.2, 7.3, 7.5.

**Prerequisite:** M0a complete (`@pantry/shared` and `@pantry/theme` packages exist; tags exist) and M0b complete (all `/v1/auth/*` and `PATCH /v1/me` endpoints exist).

**M0 sub-plans (executed in order):**

1. **M0a** — Foundation: monorepo, shared schemas, theme tokens, API skeleton, auth services
2. **M0b** — API auth routes
3. **M0c (this plan)** — Mobile app shell with full auth flow + theme switcher
4. **M0d** — Admin shell with TOTP login + Ansible/systemd/nginx + deploy pipeline

**Out of scope for M0c:**

- WatermelonDB models, scan flow, OCR, records UI, push notifications, country auto-detection on first launch (M1).
- Reviews/votes/product UI (M2).
- Admin app (M3).
- Polished per-screen UI for Bento / Soft Clay / Material You (M4) — theme provider must work for all four token sets but only Aurora Glass screens are polished here.
- App Store / Play Store submission, EAS production profiles (M4).

---

## File map

Files in **bold** carry significant logic; the rest are scaffolding or wiring. Tests live next to the code they cover or under `tests/`.

```
apps/mobile/
├── package.json
├── tsconfig.json
├── app.config.ts                                   ← dynamic Expo config (scheme, plugins)
├── eas.json                                        ← minimal dev profile
├── babel.config.js
├── metro.config.js
├── tailwind.config.js                              ← consumes @pantry/theme tokens
├── global.css                                      ← NativeWind directives
├── nativewind-env.d.ts
├── vitest.config.ts
├── tests/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── expo-secure-store.ts
│   │   ├── expo-router.ts
│   │   └── fetch.ts
│   └── e2e/
│       └── sign-up-and-sign-in.yaml                ← Maestro happy path
├── app/                                            ← Expo Router routes
│   ├── _layout.tsx                                 ← root: providers + auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   ├── verify-email.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   └── (app)/
│       ├── _layout.tsx
│       ├── (tabs)/
│       │   ├── _layout.tsx
│       │   ├── home.tsx                            ← M1 stub
│       │   ├── browse.tsx                          ← M1 stub
│       │   ├── reviews.tsx                         ← M2 stub
│       │   └── profile.tsx                         ← settings link
│       └── settings/
│           └── theme.tsx                           ← four preview cards
└── src/
    ├── api/
    │   ├── **client.ts**                           ← fetch wrapper w/ refresh
    │   ├── **errors.ts**                           ← typed RFC7807 exception
    │   ├── query-client.ts                        ← TanStack Query defaults
    │   └── endpoints.ts                           ← thin per-endpoint funcs
    ├── auth/
    │   ├── **secure-store.ts**                     ← typed expo-secure-store wrapper
    │   ├── **session-store.ts**                    ← Zustand auth session
    │   ├── **google.ts**                           ← google-signin adapter
    │   ├── **apple.ts**                            ← apple-authentication adapter
    │   └── **passkey.ts**                          ← react-native-passkey adapter
    ├── theme/
    │   ├── **store.ts**                            ← Zustand theme store
    │   ├── **ThemeProvider.tsx**                   ← cross-fade theme provider (exports ThemeProvider, useTheme, useThemeSwitcher)
    │   ├── useTheme.ts                             ← re-export of useTheme from ThemeProvider
    │   └── tailwind-tokens.ts                     ← maps tokens → tailwind colors
    ├── components/
    │   ├── Button.tsx
    │   ├── TextField.tsx
    │   ├── Card.tsx
    │   ├── GlassCard.tsx
    │   ├── Screen.tsx
    │   └── ErrorText.tsx
    └── lib/
        ├── validate.ts                            ← zod helpers
        └── linking.ts                             ← reset/verify link parser
```

---

## Conventions

- **TDD where logic exists.** Write the failing test first, watch it fail, implement, watch it pass, commit. Scaffolding/config steps get a smoke check (`pnpm --filter mobile typecheck` or `expo start --no-dev --offline --port 19099` boot probe) instead of a unit test.
- **Conventional commits, scope `mobile`.** `feat(mobile): …`, `fix(mobile): …`, `chore(mobile): …`, `test(mobile): …`.
- **Commit after every passing task**, not per phase. Frequent commits make rollback cheap.
- **All API calls go through `src/api/client.ts`.** Never raw `fetch()` from a screen. The base URL is read once via `expo-constants`.
- **All persisted tokens go through `src/auth/secure-store.ts`.** Never call `SecureStore` directly from a screen.
- **All theme reads go through `useTheme()`.** Never import from `@pantry/theme` directly inside a screen — components consume `tokens` from context.
- **Test environment:** Vitest with `jsdom` for hooks/stores, RNTL with `@testing-library/jest-native` for screens. Native modules (`expo-secure-store`, `expo-router`, social SDKs, `expo-apple-authentication`) are mocked from `tests/mocks/`.
- **No `console.log`** in source. Tests can use it.

---

## Phase A — Workspace + Expo scaffold

### Task A1: Create the `apps/mobile/` workspace package

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Modify: `turbo.json` (already lists `apps/*` via globs — verify only)

- [ ] **Step 1: Verify pnpm workspace already includes `apps/*`**

```bash
grep -A3 'packages:' pnpm-workspace.yaml
```
Expected: includes `"apps/*"`. (Set in M0a.) If missing, add it before continuing.

- [ ] **Step 2: Create directory**

```bash
mkdir -p apps/mobile/{app,src,tests,assets}
```

- [ ] **Step 3: Write `apps/mobile/package.json`**

```json
{
  "name": "@pantry/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "build": "echo skip",
    "typecheck": "tsc --noEmit",
    "lint": "echo skip",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "maestro test tests/e2e",
    "clean": "rm -rf .expo node_modules"
  },
  "dependencies": {
    "@pantry/shared": "workspace:*",
    "@pantry/theme": "workspace:*",
    "@react-native-google-signin/google-signin": "^13.1.0",
    "@tanstack/react-query": "^5.51.0",
    "expo": "^51.0.0",
    "expo-apple-authentication": "~6.4.0",
    "expo-blur": "~13.0.0",
    "expo-constants": "~16.0.0",
    "expo-linking": "~6.3.0",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.0",
    "expo-status-bar": "~1.12.0",
    "nativewind": "^4.0.36",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "react-native-gesture-handler": "~2.16.0",
    "react-native-passkey": "^3.0.0",
    "react-native-reanimated": "~3.10.0",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "tailwindcss": "^3.4.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@testing-library/jest-native": "^5.4.3",
    "@testing-library/react-native": "^12.5.0",
    "@types/react": "~18.2.79",
    "jsdom": "^24.0.0",
    "react-test-renderer": "18.2.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: Write `apps/mobile/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-native",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["react-native", "vitest/globals"],
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowJs": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["app/**/*", "src/**/*", "tests/**/*", "nativewind-env.d.ts"]
}
```

- [ ] **Step 5: Install workspace deps**

```bash
pnpm install
```
Expected: lockfile updated, `apps/mobile/node_modules` populated.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(mobile): scaffold @pantry/mobile workspace package"
```

---

### Task A2: Expo dynamic config

**Files:**
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`

- [ ] **Step 1: Write `apps/mobile/app.config.ts`**

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Pantry',
  slug: 'pantry',
  scheme: 'pantry',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0b0a17',
  },
  ios: {
    bundleIdentifier: 'com.pantry.app',
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.pantry.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b0a17',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER' },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? 'localhost',
  },
  experiments: { typedRoutes: true },
};

export default config;
```

- [ ] **Step 2: Write `apps/mobile/eas.json`**

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

- [ ] **Step 3: Write `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [ ] **Step 4: Write `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole repo and look up node_modules in both places
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 5: Smoke check Expo can read the config**

```bash
pnpm --filter @pantry/mobile exec expo config --type prebuild >/dev/null
```
Expected: exits 0 (no errors printing the resolved config).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): expo dynamic config, eas, babel, metro"
```

---

### Task A3: NativeWind + Tailwind wired to theme tokens

**Files:**
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/nativewind-env.d.ts`
- Create: `apps/mobile/src/theme/tailwind-tokens.ts`

- [ ] **Step 1: Write `apps/mobile/src/theme/tailwind-tokens.ts`**

```ts
import { aurora } from '@pantry/theme';

/**
 * Tailwind needs static class names at build time, so we feed it the Aurora
 * palette as the default token set. Runtime theme switching is handled by the
 * theme provider injecting CSS-variable-like values via context; the Tailwind
 * config is only the bootstrap baseline.
 */
export const tailwindTokens = {
  colors: {
    bg: aurora.colors.bg,
    'bg-elevated': aurora.colors.bgElevated,
    'bg-glass': aurora.colors.bgGlass,
    border: aurora.colors.border,
    fg: aurora.colors.text,
    'fg-muted': aurora.colors.textMuted,
    primary: aurora.colors.primary,
    'primary-fg': aurora.colors.primaryFg,
    accent: aurora.colors.accent,
    success: aurora.colors.success,
    warning: aurora.colors.warning,
    danger: aurora.colors.danger,
  },
  borderRadius: {
    sm: `${aurora.radii.sm}px`,
    md: `${aurora.radii.md}px`,
    lg: `${aurora.radii.lg}px`,
    xl: `${aurora.radii.xl}px`,
    pill: `${aurora.radii.pill}px`,
  },
};
```

- [ ] **Step 2: Write `apps/mobile/tailwind.config.js`**

```js
const { tailwindTokens } = require('./src/theme/tailwind-tokens.ts');

module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: tailwindTokens,
  },
  plugins: [],
};
```

- [ ] **Step 3: Write `apps/mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Write `apps/mobile/nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): nativewind + tailwind config wired to @pantry/theme"
```

---

### Task A4: Vitest harness for mobile

**Files:**
- Create: `apps/mobile/vitest.config.ts`
- Create: `apps/mobile/tests/setup.ts`
- Create: `apps/mobile/tests/mocks/expo-secure-store.ts`
- Create: `apps/mobile/tests/mocks/expo-router.ts`
- Create: `apps/mobile/tests/mocks/fetch.ts`

- [ ] **Step 1: Write `apps/mobile/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    pool: 'forks',
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'expo-secure-store': path.resolve(__dirname, 'tests/mocks/expo-secure-store.ts'),
      'expo-router': path.resolve(__dirname, 'tests/mocks/expo-router.ts'),
      'expo-constants': path.resolve(__dirname, 'tests/mocks/expo-constants.ts'),
    },
  },
});
```

- [ ] **Step 2: Write `apps/mobile/tests/setup.ts`**

```ts
import '@testing-library/jest-native/extend-expect';
import { vi, beforeEach } from 'vitest';

// Default global fetch mock; individual tests can override.
const defaultFetch = vi.fn(async () =>
  new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
);
beforeEach(() => {
  defaultFetch.mockClear();
  (globalThis as any).fetch = defaultFetch;
});

// React Native Reanimated test shim
vi.mock('react-native-reanimated', async () => {
  return {
    default: { call: () => undefined },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
    Easing: { inOut: () => undefined, ease: undefined },
    runOnJS: <T,>(fn: T) => fn,
    View: 'Animated.View',
  };
});

// Apple authentication: iOS-only native module — stub for tests
vi.mock('expo-apple-authentication', () => ({
  isAvailableAsync: vi.fn(async () => true),
  signInAsync: vi.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// Google Sign-in
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn(async () => true),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

// Passkey
vi.mock('react-native-passkey', () => ({
  Passkey: { authenticate: vi.fn(), register: vi.fn() },
}));
```

- [ ] **Step 3: Write `apps/mobile/tests/mocks/expo-secure-store.ts`**

```ts
const store = new Map<string, string>();
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export async function setItemAsync(k: string, v: string) {
  store.set(k, v);
}
export async function getItemAsync(k: string) {
  return store.get(k) ?? null;
}
export async function deleteItemAsync(k: string) {
  store.delete(k);
}
export function __reset() {
  store.clear();
}
```

- [ ] **Step 4: Write `apps/mobile/tests/mocks/expo-router.ts`**

```ts
import { vi } from 'vitest';

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};
export const useRouter = () => router;
export const useLocalSearchParams = () => ({});
export const Link = ({ children }: { children: unknown }) => children as never;
export const Redirect = ({ href }: { href: string }) => {
  router.replace(href);
  return null;
};
export const Stack = Object.assign(
  ({ children }: { children?: unknown }) => children as never,
  { Screen: () => null },
);
export const Tabs = Object.assign(
  ({ children }: { children?: unknown }) => children as never,
  { Screen: () => null },
);
```

- [ ] **Step 5: Write `apps/mobile/tests/mocks/expo-constants.ts`**

```ts
export default {
  expoConfig: {
    extra: {
      apiBaseUrl: 'http://localhost:4000',
      googleWebClientId: 'test-google-web',
      googleIosClientId: 'test-google-ios',
      passkeyRpId: 'localhost',
    },
  },
};
```

- [ ] **Step 6: Write `apps/mobile/tests/mocks/fetch.ts`**

```ts
import { vi } from 'vitest';

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function problemResponse(code: string, status: number, title = 'Error'): Response {
  return new Response(JSON.stringify({ code, status, title }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export function queueFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  (globalThis as any).fetch = fn;
  return fn;
}
```

- [ ] **Step 7: Smoke test that vitest runs with zero specs**

```bash
pnpm --filter @pantry/mobile test -- --passWithNoTests
```
Expected: `No test files found` or `passed`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test(mobile): vitest harness with native module mocks"
```

---

## Phase B — Secure storage + API client + query client

### Task B1: Secure-store wrapper (TDD)

**Files:**
- Create: `apps/mobile/src/auth/secure-store.ts`
- Create: `apps/mobile/src/auth/secure-store.test.ts`

- [ ] **Step 1: Write the failing test `apps/mobile/src/auth/secure-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from '../../tests/mocks/expo-secure-store';
import { secureStore } from './secure-store';

describe('secureStore', () => {
  beforeEach(() => __reset());

  it('round-trips a string value', async () => {
    await secureStore.setAccessToken('abc.def.ghi');
    expect(await secureStore.getAccessToken()).toBe('abc.def.ghi');
  });

  it('returns null when a key is unset', async () => {
    expect(await secureStore.getRefreshToken()).toBeNull();
  });

  it('clearAll wipes every known key', async () => {
    await secureStore.setAccessToken('a');
    await secureStore.setRefreshToken('b');
    await secureStore.setThemePreference('clay');
    await secureStore.clearAll();
    expect(await secureStore.getAccessToken()).toBeNull();
    expect(await secureStore.getRefreshToken()).toBeNull();
    expect(await secureStore.getThemePreference()).toBeNull();
  });

  it('only stores valid theme ids', async () => {
    // @ts-expect-error — runtime check
    await expect(secureStore.setThemePreference('neon')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/auth/secure-store.test.ts
```
Expected: FAIL — `secureStore` does not exist.

- [ ] **Step 3: Write `apps/mobile/src/auth/secure-store.ts`**

```ts
import * as SecureStore from 'expo-secure-store';
import type { ThemeId } from '@pantry/theme';

const KEY_ACCESS = 'pantry.access_token';
const KEY_REFRESH = 'pantry.refresh_token';
const KEY_THEME = 'pantry.theme_preference';

const THEME_IDS: readonly ThemeId[] = ['aurora', 'bento', 'clay', 'material'];

function isThemeId(v: string): v is ThemeId {
  return (THEME_IDS as readonly string[]).includes(v);
}

export const secureStore = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_ACCESS, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_REFRESH, token);
  },

  async getThemePreference(): Promise<ThemeId | null> {
    const v = await SecureStore.getItemAsync(KEY_THEME);
    if (v && isThemeId(v)) return v;
    return null;
  },
  async setThemePreference(v: ThemeId): Promise<void> {
    if (!isThemeId(v)) throw new Error(`invalid theme id: ${v}`);
    await SecureStore.setItemAsync(KEY_THEME, v);
  },

  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_ACCESS);
    await SecureStore.deleteItemAsync(KEY_REFRESH);
    await SecureStore.deleteItemAsync(KEY_THEME);
  },
};
```

- [ ] **Step 4: Run, verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/auth/secure-store.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): typed expo-secure-store wrapper"
```

---

### Task B2: Typed API error class (TDD)

**Files:**
- Create: `apps/mobile/src/api/errors.ts`
- Create: `apps/mobile/src/api/errors.test.ts`

- [ ] **Step 1: Write the failing test `apps/mobile/src/api/errors.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ApiError, isApiError } from './errors';

describe('ApiError', () => {
  it('captures code, status, title, and detail', () => {
    const err = new ApiError({
      code: 'invalid_credentials',
      status: 401,
      title: 'Invalid credentials',
      detail: 'bad password',
    });
    expect(err.code).toBe('invalid_credentials');
    expect(err.status).toBe(401);
    expect(err.title).toBe('Invalid credentials');
    expect(err.detail).toBe('bad password');
    expect(err.message).toBe('Invalid credentials');
  });

  it('isApiError narrows correctly', () => {
    const e: unknown = new ApiError({ code: 'x', status: 400, title: 'X' });
    expect(isApiError(e)).toBe(true);
    expect(isApiError(new Error('nope'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/errors.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/api/errors.ts`**

```ts
export interface ApiErrorOptions {
  code: string;
  status: number;
  title: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Array<{ path: string; message: string }>;

  constructor(opts: ApiErrorOptions) {
    super(opts.title);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/errors.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): typed ApiError for RFC 7807 responses"
```

---

### Task B3: API client — base happy path (TDD)

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/client.test.ts`

- [ ] **Step 1: Write the failing test `apps/mobile/src/api/client.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from '../../tests/mocks/expo-secure-store';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { apiClient } from './client';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';

describe('apiClient — happy path', () => {
  beforeEach(() => __reset());

  it('builds URLs with the /v1 prefix from expo-constants', async () => {
    const f = queueFetch(jsonResponse({ status: 'ok' }));
    await apiClient.request({ method: 'GET', path: '/health' });
    expect(f).toHaveBeenCalledOnce();
    const [url] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/health');
  });

  it('injects Authorization: Bearer <access> when a token is stored', async () => {
    await secureStore.setAccessToken('access-123');
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.request({ method: 'GET', path: '/me' });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-123');
  });

  it('serialises JSON bodies and sets content-type', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.request({ method: 'POST', path: '/auth/login', body: { email: 'a@b.c' } });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns parsed JSON for a 2xx response', async () => {
    queueFetch(jsonResponse({ hello: 'world' }));
    const result = await apiClient.request<{ hello: string }>({ method: 'GET', path: '/x' });
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws ApiError carrying RFC 7807 fields on 4xx', async () => {
    queueFetch(problemResponse('invalid_credentials', 401, 'Invalid credentials'));
    await expect(apiClient.request({ method: 'POST', path: '/auth/login' }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('apiClient.get prepends /v1 to the path', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.get<{ ok: true }>('/foo');
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/foo');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('apiClient.post sends JSON body via convenience method', async () => {
    const f = queueFetch(jsonResponse({ ok: true }));
    await apiClient.post<{ ok: true }>('/bar', { x: 1 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/bar');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(JSON.stringify({ x: 1 }));
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/client.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/api/client.ts`** (refresh logic added in B4; this is the base)

```ts
import Constants from 'expo-constants';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';

// path must NOT include /v1 prefix; client adds it
export type ApiClientOpts = { headers?: Record<string, string>; skipAuth?: boolean };

interface ApiRequest extends ApiClientOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

function getBaseUrl(): string {
  const url = (Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  if (!url) throw new Error('apiBaseUrl not configured');
  return url.replace(/\/+$/, '');
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { code?: string; status?: number; title?: string; detail?: string; errors?: Array<{ path: string; message: string }> } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // non-JSON error
  }
  return new ApiError({
    code: body.code ?? 'unknown_error',
    status: body.status ?? res.status,
    title: body.title ?? res.statusText ?? 'Request failed',
    detail: body.detail,
    errors: body.errors,
  });
}

async function doFetch<T>(req: ApiRequest): Promise<T> {
  // path must NOT include /v1 prefix; client adds it
  const url = `${getBaseUrl()}/v1${req.path.startsWith('/') ? '' : '/'}${req.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(req.headers ?? {}),
  };
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!req.skipAuth) {
    const access = await secureStore.getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  request: doFetch,
  get: <T,>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'GET', path, ...opts }),
  post: <T,>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'POST', path, body, ...opts }),
  patch: <T,>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'PATCH', path, body, ...opts }),
  delete: <T,>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'DELETE', path, ...opts }),
};
```

- [ ] **Step 4: Run, verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/client.test.ts
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): api client base — url, headers, json, ApiError"
```

---

### Task B4: API client — refresh on 401 (TDD)

**Files:**
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/api/client.test.ts`

- [ ] **Step 1: Append the failing refresh tests to `client.test.ts`**

```ts
describe('apiClient — refresh on 401', () => {
  beforeEach(() => __reset());

  it('refreshes once on 401, replays the request, returns the success body', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('refresh-1');

    const f = queueFetch(
      problemResponse('token_expired', 401, 'expired'), // first call
      jsonResponse({ accessToken: 'new-access', refreshToken: 'refresh-2', expiresIn: 900 }), // refresh
      jsonResponse({ ok: true }), // replay
    );

    const result = await apiClient.request<{ ok: true }>({ method: 'GET', path: '/me' });
    expect(result).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    expect(await secureStore.getAccessToken()).toBe('new-access');
    expect(await secureStore.getRefreshToken()).toBe('refresh-2');
  });

  it('does not retry when there is no refresh token', async () => {
    await secureStore.setAccessToken('expired');
    const f = queueFetch(problemResponse('token_expired', 401, 'expired'));
    await expect(apiClient.request({ method: 'GET', path: '/me' })).rejects.toBeInstanceOf(ApiError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and throws when refresh itself returns 401', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('bad-refresh');
    queueFetch(
      problemResponse('token_expired', 401, 'expired'),
      problemResponse('invalid_token', 401, 'refresh bad'),
    );
    await expect(apiClient.request({ method: 'GET', path: '/me' })).rejects.toBeInstanceOf(ApiError);
    expect(await secureStore.getAccessToken()).toBeNull();
    expect(await secureStore.getRefreshToken()).toBeNull();
  });

  it('only refreshes once even with concurrent failing requests', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('refresh-1');
    const f = queueFetch(
      problemResponse('token_expired', 401, 'expired'),
      problemResponse('token_expired', 401, 'expired'),
      jsonResponse({ accessToken: 'new', refreshToken: 'r2', expiresIn: 900 }),
      jsonResponse({ a: 1 }),
      jsonResponse({ b: 2 }),
    );
    const [r1, r2] = await Promise.all([
      apiClient.request({ method: 'GET', path: '/a' }),
      apiClient.request({ method: 'GET', path: '/b' }),
    ]);
    expect(r1).toEqual({ a: 1 });
    expect(r2).toEqual({ b: 2 });
    // Verify only ONE refresh call (the third call in the queue)
    const refreshCalls = f.mock.calls.filter(([url]) =>
      String(url).endsWith('/v1/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/client.test.ts
```

- [ ] **Step 3: Replace `apps/mobile/src/api/client.ts`**

```ts
import Constants from 'expo-constants';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';

// path must NOT include /v1 prefix; client adds it
export type ApiClientOpts = { headers?: Record<string, string>; skipAuth?: boolean };

interface ApiRequest extends ApiClientOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type RefreshListener = (ok: boolean) => void;

function getBaseUrl(): string {
  const url = (Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  if (!url) throw new Error('apiBaseUrl not configured');
  return url.replace(/\/+$/, '');
}

async function parseError(res: Response): Promise<ApiError> {
  let body: {
    code?: string;
    status?: number;
    title?: string;
    detail?: string;
    errors?: Array<{ path: string; message: string }>;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // non-JSON
  }
  return new ApiError({
    code: body.code ?? 'unknown_error',
    status: body.status ?? res.status,
    title: body.title ?? res.statusText ?? 'Request failed',
    detail: body.detail,
    errors: body.errors,
  });
}

// --- Single-flight refresh ---

let refreshInFlight: Promise<boolean> | null = null;
let onSignOut: (() => void) | null = null;

export function setOnSignOut(cb: () => void) {
  onSignOut = cb;
}

async function refreshTokensOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = await secureStore.getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${getBaseUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        await secureStore.clearAll();
        onSignOut?.();
        return false;
      }
      const data = (await res.json()) as RefreshResponse;
      await secureStore.setAccessToken(data.accessToken);
      await secureStore.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      await secureStore.clearAll();
      onSignOut?.();
      return false;
    } finally {
      // delay clearing until microtask flush so concurrent callers can await
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

async function doFetch<T>(req: ApiRequest, retrying = false): Promise<T> {
  // path must NOT include /v1 prefix; client adds it
  const url = `${getBaseUrl()}/v1${req.path.startsWith('/') ? '' : '/'}${req.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(req.headers ?? {}),
  };
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!req.skipAuth) {
    const access = await secureStore.getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  if (res.status === 401 && !retrying && !req.skipAuth && !req.path.startsWith('/auth/')) {
    const refreshed = await refreshTokensOnce();
    if (refreshed) return doFetch<T>(req, true);
    throw await parseError(res);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  request: doFetch,
  get: <T,>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'GET', path, ...opts }),
  post: <T,>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'POST', path, body, ...opts }),
  patch: <T,>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'PATCH', path, body, ...opts }),
  delete: <T,>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'DELETE', path, ...opts }),
};
```

- [ ] **Step 4: Run, verify all client tests pass**

```bash
pnpm --filter @pantry/mobile exec vitest run src/api/client.test.ts
```
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): api client refresh-on-401 with single-flight"
```

---

### Task B5: TanStack Query client

**Files:**
- Create: `apps/mobile/src/api/query-client.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/query-client.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, err) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(mobile): TanStack Query client defaults"
```

---

### Task B6: Endpoint helpers

**Files:**
- Create: `apps/mobile/src/api/endpoints.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/endpoints.ts`**

```ts
import type {
  AuthResult,
  LoginInput,
  RegisterInput,
  Tokens,
  User,
  UpdateProfile,
} from '@pantry/shared';
import { apiClient } from './client';

/**
 * Server response shape when an account requires a TOTP step. Mobile users
 * rarely hit this (admins use the admin web app), but the type must be correct.
 */
export interface TotpChallenge {
  requiresTotp: true;
  challengeToken: string;
}

export const authEndpoints = {
  register: (input: RegisterInput) =>
    apiClient.request<AuthResult>({ method: 'POST', path: '/auth/register', body: input, skipAuth: true }),
  login: (input: LoginInput) =>
    apiClient.request<AuthResult | TotpChallenge>({ method: 'POST', path: '/auth/login', body: input, skipAuth: true }),
  refresh: (refreshToken: string) =>
    apiClient.request<Tokens>({ method: 'POST', path: '/auth/refresh', body: { refreshToken }, skipAuth: true }),
  logout: () =>
    apiClient.request<void>({ method: 'POST', path: '/auth/logout' }),
  me: () =>
    apiClient.request<User>({ method: 'GET', path: '/auth/me' }),
  resendVerification: (email: string) =>
    apiClient.request<{ ok: true }>({ method: 'POST', path: '/auth/resend-verification', body: { email }, skipAuth: true }),
  forgotPassword: (email: string) =>
    apiClient.request<{ ok: true }>({ method: 'POST', path: '/auth/forgot-password', body: { email }, skipAuth: true }),
  resetPassword: (token: string, password: string) =>
    apiClient.request<{ ok: true }>({ method: 'POST', path: '/auth/reset-password', body: { token, password }, skipAuth: true }),
  oauthGoogle: (idToken: string) =>
    apiClient.request<AuthResult>({ method: 'POST', path: '/auth/oauth/google', body: { idToken }, skipAuth: true }),
  oauthApple: (identityToken: string, firstName?: string, lastName?: string) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/oauth/apple',
      body: { identityToken, firstName, lastName },
      skipAuth: true,
    }),
  passkeyLoginOptions: (email?: string) =>
    apiClient.request<unknown>({ method: 'POST', path: '/auth/passkey/login/options', body: { email }, skipAuth: true }),
  passkeyLoginVerify: (assertionResponse: unknown) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/passkey/login/verify',
      body: { assertionResponse },
      skipAuth: true,
    }),
};

export const meEndpoints = {
  update: (input: UpdateProfile) =>
    apiClient.request<User>({ method: 'PATCH', path: '/me', body: input }),
};
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(mobile): typed endpoint helpers for auth + me"
```

---

## Phase C — Theme provider + switcher

### Task C1: Theme Zustand store (TDD)

**Files:**
- Create: `apps/mobile/src/theme/store.ts`
- Create: `apps/mobile/src/theme/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/theme/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from '../../tests/mocks/expo-secure-store';
import { useThemeStore, initThemeStore } from './store';

describe('theme store', () => {
  beforeEach(() => {
    __reset();
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
  });

  it('defaults to aurora when no preference is stored', async () => {
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('aurora');
    expect(useThemeStore.getState().hydrated).toBe(true);
  });

  it('hydrates from secure store on init', async () => {
    const { secureStore } = await import('../auth/secure-store');
    await secureStore.setThemePreference('clay');
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('clay');
  });

  it('setTheme updates state and persists to secure store', async () => {
    const { secureStore } = await import('../auth/secure-store');
    await initThemeStore();
    await useThemeStore.getState().setTheme('material');
    expect(useThemeStore.getState().themeId).toBe('material');
    expect(await secureStore.getThemePreference()).toBe('material');
  });

  it('rejects an invalid theme id at runtime', async () => {
    await initThemeStore();
    // @ts-expect-error — runtime check
    await expect(useThemeStore.getState().setTheme('neon')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/store.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/theme/store.ts`**

```ts
import { create } from 'zustand';
import type { ThemeId } from '@pantry/theme';
import { secureStore } from '../auth/secure-store';

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  setTheme: (id: ThemeId) => Promise<void>;
}

const VALID_IDS: readonly ThemeId[] = ['aurora', 'bento', 'clay', 'material'];

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'aurora',
  hydrated: false,
  setTheme: async (id) => {
    if (!(VALID_IDS as readonly string[]).includes(id)) {
      throw new Error(`invalid theme id: ${id}`);
    }
    await secureStore.setThemePreference(id);
    set({ themeId: id });
  },
}));

export async function initThemeStore(): Promise<void> {
  const stored = await secureStore.getThemePreference();
  useThemeStore.setState({ themeId: stored ?? 'aurora', hydrated: true });
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): theme zustand store with secure-store persistence"
```

---

### Task C2: Theme provider with cross-fade transition

**Files:**
- Create: `apps/mobile/src/theme/useTheme.ts`
- Create: `apps/mobile/src/theme/ThemeProvider.tsx`
- Create: `apps/mobile/src/theme/ThemeProvider.test.tsx`

- [ ] **Step 1: Write `apps/mobile/src/theme/useTheme.ts`** (one-line re-export so importers can use either `'../theme/ThemeProvider'` or `'../theme/useTheme'`)

```ts
export { useTheme } from './ThemeProvider';
```

- [ ] **Step 2: Write the failing test `apps/mobile/src/theme/ThemeProvider.test.tsx`**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme, useThemeSwitcher } from './ThemeProvider';
import { useThemeStore, initThemeStore } from './store';
import { __reset } from '../../tests/mocks/expo-secure-store';

function Probe() {
  const theme = useTheme();
  return <Text testID="probe">{theme.id}:{theme.name}</Text>;
}

function SwitcherProbe() {
  const { themeId } = useThemeSwitcher();
  return <Text testID="switcher-probe">{themeId}</Text>;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
    await initThemeStore();
  });

  it('provides Aurora Glass tokens by default', () => {
    const { getByTestId } = render(
      <ThemeProvider><Probe /></ThemeProvider>,
    );
    expect(getByTestId('probe').props.children.join('')).toBe('aurora:Aurora Glass');
  });

  it('re-renders children when the store theme changes', async () => {
    const { getByTestId } = render(
      <ThemeProvider><Probe /></ThemeProvider>,
    );
    await act(async () => {
      await useThemeStore.getState().setTheme('clay');
    });
    await waitFor(() => {
      expect(getByTestId('probe').props.children.join('')).toBe('clay:Soft Clay');
    });
  });

  it('honours the `initial` prop on first mount', async () => {
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
    const { getByTestId } = render(
      <ThemeProvider initial="bento"><Probe /></ThemeProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('probe').props.children.join('')).toBe('bento:Bento');
    });
  });

  it('useThemeSwitcher.setTheme updates the store and themeId reflects the new id', async () => {
    const { getByTestId } = render(
      <ThemeProvider><SwitcherProbe /></ThemeProvider>,
    );
    await act(async () => {
      await useThemeStore.getState().setTheme('bento');
    });
    await waitFor(() => {
      expect(getByTestId('switcher-probe').props.children).toBe('bento');
    });
    expect(useThemeStore.getState().themeId).toBe('bento');
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/ThemeProvider.test.tsx
```

- [ ] **Step 4: Write `apps/mobile/src/theme/ThemeProvider.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { themes, type Theme, type ThemeId } from '@pantry/theme';
import { useThemeStore } from './store';

export const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Optional initial theme id — applied to the store on first mount. */
  initial?: ThemeId;
}

export function ThemeProvider({ children, initial }: ThemeProviderProps) {
  // Apply the initial prop exactly once on mount (before paint via layout effect would be ideal,
  // but useEffect is fine here because the store starts in a hydrated=false state).
  useEffect(() => {
    if (initial) useThemeStore.setState({ themeId: initial, hydrated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const themeId = useThemeStore((s) => s.themeId);
  const theme = themes[themeId];
  const fade = useRef(new Animated.Value(1)).current;
  const prevId = useRef(themeId);

  useEffect(() => {
    if (prevId.current === themeId) return;
    prevId.current = themeId;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: theme.animation.themeSwitch, // 200ms per spec §2.10
      useNativeDriver: true,
    }).start();
  }, [themeId, fade, theme.animation.themeSwitch]);

  const value = useMemo(() => theme, [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={[styles.root, { opacity: fade, backgroundColor: theme.colors.bg }]}>
        <View style={styles.fill}>{children}</View>
      </Animated.View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useThemeSwitcher() {
  return useThemeStore((s) => ({ themeId: s.themeId, setTheme: s.setTheme }));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
```

- [ ] **Step 5: Run, verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/ThemeProvider.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): ThemeProvider with 200ms cross-fade, initial prop, useThemeSwitcher"
```

---

### Task C3: Sync theme preference to the server (TDD)

**Files:**
- Modify: `apps/mobile/src/theme/store.ts`
- Create: `apps/mobile/src/theme/sync.ts`
- Create: `apps/mobile/src/theme/sync.test.ts`

- [ ] **Step 1: Write the failing test `apps/mobile/src/theme/sync.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncThemeToServer } from './sync';
import { jsonResponse, queueFetch } from '../../tests/mocks/fetch';
import { secureStore } from '../auth/secure-store';
import { __reset } from '../../tests/mocks/expo-secure-store';

describe('syncThemeToServer', () => {
  beforeEach(() => __reset());

  it('PATCHes /v1/me with theme_preference when authed', async () => {
    await secureStore.setAccessToken('a');
    const f = queueFetch(jsonResponse({ id: 'u', themePreference: 'bento' }));
    await syncThemeToServer('bento');
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/me');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as RequestInit).body).toBe(JSON.stringify({ themePreference: 'bento' }));
  });

  it('is a no-op when there is no access token', async () => {
    const f = queueFetch();
    await syncThemeToServer('aurora');
    expect(f).not.toHaveBeenCalled();
  });

  it('swallows errors so a failed sync never breaks the UI', async () => {
    await secureStore.setAccessToken('a');
    queueFetch(new Response('boom', { status: 500 }));
    await expect(syncThemeToServer('clay')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/sync.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/theme/sync.ts`**

```ts
import type { ThemeId } from '@pantry/theme';
import { secureStore } from '../auth/secure-store';
import { meEndpoints } from '../api/endpoints';

export async function syncThemeToServer(themeId: ThemeId): Promise<void> {
  const token = await secureStore.getAccessToken();
  if (!token) return;
  try {
    await meEndpoints.update({ themePreference: themeId });
  } catch {
    // best-effort — the preference is already stored locally
  }
}
```

- [ ] **Step 4: Wire sync into the store. Replace the `setTheme` body in `apps/mobile/src/theme/store.ts`**

```ts
import { create } from 'zustand';
import type { ThemeId } from '@pantry/theme';
import { secureStore } from '../auth/secure-store';
import { syncThemeToServer } from './sync';

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  setTheme: (id: ThemeId) => Promise<void>;
}

const VALID_IDS: readonly ThemeId[] = ['aurora', 'bento', 'clay', 'material'];

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'aurora',
  hydrated: false,
  setTheme: async (id) => {
    if (!(VALID_IDS as readonly string[]).includes(id)) {
      throw new Error(`invalid theme id: ${id}`);
    }
    await secureStore.setThemePreference(id);
    set({ themeId: id });
    void syncThemeToServer(id);
  },
}));

export async function initThemeStore(): Promise<void> {
  const stored = await secureStore.getThemePreference();
  useThemeStore.setState({ themeId: stored ?? 'aurora', hydrated: true });
}
```

- [ ] **Step 5: Run all theme tests**

```bash
pnpm --filter @pantry/mobile exec vitest run src/theme/
```
Expected: all tests in `store.test.ts`, `ThemeProvider.test.tsx`, `sync.test.ts` pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): sync theme preference to /v1/me on change"
```

---

## Phase D — Auth session store + screens

### Task D1: Session store (TDD)

**Files:**
- Create: `apps/mobile/src/auth/session-store.ts`
- Create: `apps/mobile/src/auth/session-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/auth/session-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore, hydrateSession } from './session-store';
import { secureStore } from './secure-store';
import { __reset } from '../../tests/mocks/expo-secure-store';

const USER = {
  id: 'u1',
  email: 'a@b.c',
  emailVerified: true,
  firstName: 'A',
  lastName: 'B',
  country: null,
  avatarUrl: null,
  role: 'user' as const,
  status: 'active' as const,
  themePreference: 'aurora' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('session store', () => {
  beforeEach(() => {
    __reset();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: false });
  });

  it('signIn populates state and persists tokens', async () => {
    await useSessionStore.getState().signIn({
      user: USER,
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    expect(useSessionStore.getState().user?.id).toBe('u1');
    expect(useSessionStore.getState().accessToken).toBe('a');
    expect(await secureStore.getAccessToken()).toBe('a');
    expect(await secureStore.getRefreshToken()).toBe('r');
  });

  it('signOut clears state and tokens', async () => {
    await useSessionStore.getState().signIn({
      user: USER,
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    await useSessionStore.getState().signOut();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(await secureStore.getAccessToken()).toBeNull();
  });

  it('hydrateSession loads tokens from secure-store and marks hydrated=true', async () => {
    await secureStore.setAccessToken('a');
    await secureStore.setRefreshToken('r');
    await hydrateSession();
    expect(useSessionStore.getState().accessToken).toBe('a');
    expect(useSessionStore.getState().refreshToken).toBe('r');
    expect(useSessionStore.getState().hydrated).toBe(true);
  });

  it('hydrateSession marks hydrated=true even when no tokens exist', async () => {
    await hydrateSession();
    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/auth/session-store.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/auth/session-store.ts`**

```ts
import { create } from 'zustand';
import type { AuthResult, User } from '@pantry/shared';
import { secureStore } from './secure-store';

interface SessionState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  signIn: async ({ user, tokens }) => {
    await secureStore.setAccessToken(tokens.accessToken);
    await secureStore.setRefreshToken(tokens.refreshToken);
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },
  signOut: async () => {
    await secureStore.clearAll();
    set({ user: null, accessToken: null, refreshToken: null });
  },
  setUser: (user) => set({ user }),
}));

export async function hydrateSession(): Promise<void> {
  const accessToken = await secureStore.getAccessToken();
  const refreshToken = await secureStore.getRefreshToken();
  useSessionStore.setState({ accessToken, refreshToken, hydrated: true });
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/auth/session-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): zustand session store with secure-store hydration"
```

---

### Task D2: Wire session-store signOut into the API client refresh hook

**Files:**
- Create: `apps/mobile/src/auth/wire-client.ts`
- Modify: nothing else; this module is imported once at app startup.

- [ ] **Step 1: Write `apps/mobile/src/auth/wire-client.ts`**

```ts
import { setOnSignOut } from '../api/client';
import { useSessionStore } from './session-store';

let wired = false;
export function wireApiClient(): void {
  if (wired) return;
  wired = true;
  setOnSignOut(() => {
    // Fire-and-forget — secureStore is already cleared by the refresh path
    void useSessionStore.getState().signOut();
  });
}
```

- [ ] **Step 2: Commit (will be invoked from the root layout in Task F1)**

```bash
git add -A
git commit -m "feat(mobile): wire api client sign-out callback into session store"
```

---

### Task D3: Validation helpers (TDD)

**Files:**
- Create: `apps/mobile/src/lib/validate.ts`
- Create: `apps/mobile/src/lib/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/lib/validate.test.ts
import { describe, it, expect } from 'vitest';
import { fieldErrors } from './validate';
import { registerSchema } from '@pantry/shared';

describe('fieldErrors', () => {
  it('returns empty object when input is valid', () => {
    const errs = fieldErrors(registerSchema, {
      email: 'a@b.co',
      password: 'correct-horse-battery-staple',
      firstName: 'A',
      lastName: 'B',
    });
    expect(errs).toEqual({});
  });

  it('returns per-field error messages when invalid', () => {
    const errs = fieldErrors(registerSchema, {
      email: 'nope',
      password: 'short',
      firstName: '',
      lastName: '',
    });
    expect(errs.email).toBeDefined();
    expect(errs.password).toBeDefined();
    expect(errs.firstName).toBeDefined();
    expect(errs.lastName).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/lib/validate.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/lib/validate.ts`**

```ts
import { type ZodTypeAny } from 'zod';

export type FieldErrors = Record<string, string>;

export function fieldErrors<S extends ZodTypeAny>(schema: S, input: unknown): FieldErrors {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/lib/validate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): zod fieldErrors helper for form validation"
```

---

### Task D4: Deep linking parser (TDD)

**Files:**
- Create: `apps/mobile/src/lib/linking.ts`
- Create: `apps/mobile/src/lib/linking.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/lib/linking.test.ts
import { describe, it, expect } from 'vitest';
import { parseAuthDeepLink } from './linking';

describe('parseAuthDeepLink', () => {
  it('parses a reset-password link with token', () => {
    const r = parseAuthDeepLink('pantry://reset-password?token=abc');
    expect(r).toEqual({ kind: 'reset-password', token: 'abc' });
  });

  it('parses a verify-email link with token', () => {
    const r = parseAuthDeepLink('pantry://verify-email?token=xyz');
    expect(r).toEqual({ kind: 'verify-email', token: 'xyz' });
  });

  it('returns null for unrecognized links', () => {
    expect(parseAuthDeepLink('pantry://home')).toBeNull();
    expect(parseAuthDeepLink('https://example.com')).toBeNull();
  });

  it('returns null when the token is missing', () => {
    expect(parseAuthDeepLink('pantry://reset-password')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run src/lib/linking.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/lib/linking.ts`**

```ts
export type AuthDeepLink =
  | { kind: 'reset-password'; token: string }
  | { kind: 'verify-email'; token: string };

export function parseAuthDeepLink(url: string): AuthDeepLink | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'pantry:') return null;
    const path = u.host || u.pathname.replace(/^\//, '');
    const token = u.searchParams.get('token');
    if (!token) return null;
    if (path === 'reset-password') return { kind: 'reset-password', token };
    if (path === 'verify-email') return { kind: 'verify-email', token };
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run src/lib/linking.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): deep link parser for reset/verify URLs"
```

---

## Phase E — Reusable UI components (Aurora-polished)

### Task E1: Screen + Button + TextField + ErrorText

**Files:**
- Create: `apps/mobile/src/components/Screen.tsx`
- Create: `apps/mobile/src/components/Button.tsx`
- Create: `apps/mobile/src/components/TextField.tsx`
- Create: `apps/mobile/src/components/ErrorText.tsx`
- Create: `apps/mobile/src/components/Card.tsx`
- Create: `apps/mobile/src/components/GlassCard.tsx`

- [ ] **Step 1: Write `apps/mobile/src/components/Screen.tsx`**

```tsx
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      <Body contentContainerStyle={styles.body} style={styles.flex}>
        {children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { padding: 24, gap: 16 },
});
```

- [ ] **Step 2: Write `apps/mobile/src/components/Button.tsx`**

```tsx
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button(props: ButtonProps) {
  const theme = useTheme();
  const variant = props.variant ?? 'primary';
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.bgElevated
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? theme.colors.primaryFg
      : theme.colors.text;

  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderRadius: theme.radii.md, opacity: pressed || props.disabled ? 0.7 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.row}>
        {props.loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.label, { color: fg }]}>{props.label}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Write `apps/mobile/src/components/TextField.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.radii.md,
          },
        ]}
        {...rest}
      />
      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 13 },
});
```

- [ ] **Step 4: Write `apps/mobile/src/components/ErrorText.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function ErrorText({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text testID={testID} style={[styles.t, { color: theme.colors.danger }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  t: { fontSize: 14, fontWeight: '500' },
});
```

- [ ] **Step 5: Write `apps/mobile/src/components/Card.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, gap: 12 },
});
```

- [ ] **Step 6: Write `apps/mobile/src/components/GlassCard.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/useTheme';

export function GlassCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { borderRadius: theme.radii.lg, borderColor: theme.colors.border }]}>
      <BlurView intensity={40} tint={theme.scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[styles.inner, { backgroundColor: theme.colors.bgGlass }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderWidth: 1 },
  inner: { padding: 18, gap: 12 },
});
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(mobile): Screen, Button, TextField, ErrorText, Card, GlassCard"
```

---

## Phase F — Root layout, providers, auth gate

### Task F1: Root layout with all providers and auth gate

**Files:**
- Create: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Write `apps/mobile/app/_layout.tsx`**

```tsx
import '../global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { createQueryClient } from '../src/api/query-client';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../src/theme/store';
import { hydrateSession, useSessionStore } from '../src/auth/session-store';
import { wireApiClient } from '../src/auth/wire-client';
import { parseAuthDeepLink } from '../src/lib/linking';

const queryClient = createQueryClient();

export default function RootLayout() {
  const [bootError, setBootError] = useState<string | null>(null);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    wireApiClient();
    Promise.all([initThemeStore(), hydrateSession()]).catch((e) =>
      setBootError(String(e)),
    );
  }, []);

  if (bootError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!themeHydrated || !sessionHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StatusBar style="auto" />
            <AuthGate />
            <DeepLinkHandler />
            <Slot />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const accessToken = useSessionStore((s) => s.accessToken);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    if (!sessionHydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (accessToken && inAuthGroup) {
      router.replace('/(app)/(tabs)/home');
    }
  }, [accessToken, sessionHydrated, segments, router]);

  return null;
}

function DeepLinkHandler() {
  const router = useRouter();
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const link = parseAuthDeepLink(url);
      if (!link) return;
      if (link.kind === 'reset-password') router.push({ pathname: '/(auth)/reset-password', params: { token: link.token } });
      if (link.kind === 'verify-email') router.push({ pathname: '/(auth)/verify-email', params: { token: link.token } });
    });
    return () => sub.remove();
  }, [router]);
  return null;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(mobile): root layout with providers, auth gate, deep link handler"
```

---

### Task F2: Auth group layout + tabs layout

**Files:**
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/_layout.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(auth)/_layout.tsx`**

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/app/(app)/_layout.tsx`**

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/theme" options={{ headerShown: true, title: 'Theme' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/app/(app)/(tabs)/_layout.tsx`**

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.bgElevated, borderTopColor: theme.colors.border },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): (auth) and (app)/(tabs) router groups"
```

---

## Phase G — Social SDK adapters

### Task G1: Google adapter

**Files:**
- Create: `apps/mobile/src/auth/google.ts`

- [ ] **Step 1: Write `apps/mobile/src/auth/google.ts`**

```ts
import Constants from 'expo-constants';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let configured = false;

function configure() {
  if (configured) return;
  const extra = (Constants?.expoConfig?.extra ?? {}) as {
    googleWebClientId?: string;
    googleIosClientId?: string;
  };
  GoogleSignin.configure({
    webClientId: extra.googleWebClientId,
    iosClientId: extra.googleIosClientId,
    offlineAccess: false,
  });
  configured = true;
}

export class GoogleSignInCancelled extends Error {
  constructor() { super('Google sign-in cancelled'); }
}

export async function signInWithGoogle(): Promise<string> {
  configure();
  try {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    const idToken = (result as { idToken?: string; data?: { idToken?: string } }).idToken
      ?? (result as { data?: { idToken?: string } }).data?.idToken;
    if (!idToken) throw new Error('Google did not return an id_token');
    return idToken;
  } catch (e) {
    if ((e as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCancelled();
    }
    throw e;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(mobile): google sign-in adapter"
```

---

### Task G2: Apple adapter

**Files:**
- Create: `apps/mobile/src/auth/apple.ts`

- [ ] **Step 1: Write `apps/mobile/src/auth/apple.ts`**

```ts
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export interface AppleSignInResult {
  identityToken: string;
  firstName?: string;
  lastName?: string;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity_token');
  }
  return {
    identityToken: credential.identityToken,
    firstName: credential.fullName?.givenName ?? undefined,
    lastName: credential.fullName?.familyName ?? undefined,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): apple sign-in adapter (iOS-only gate)"
```

---

### Task G3: Passkey adapter

**Files:**
- Create: `apps/mobile/src/auth/passkey.ts`

- [ ] **Step 1: Write `apps/mobile/src/auth/passkey.ts`**

```ts
import { Passkey } from 'react-native-passkey';
import { authEndpoints } from '../api/endpoints';

export async function signInWithPasskey(email?: string) {
  const options = await authEndpoints.passkeyLoginOptions(email);
  // react-native-passkey expects PublicKeyCredentialRequestOptionsJSON
  const assertion = await Passkey.authenticate(options as never);
  return authEndpoints.passkeyLoginVerify(assertion);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): passkey login adapter"
```

---

## Phase H — Auth screens

### Task H1: Welcome screen

**Files:**
- Create: `apps/mobile/app/(auth)/welcome.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(auth)/welcome.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { GlassCard } from '../../src/components/GlassCard';
import { useTheme } from '../../src/theme/useTheme';

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Pantry</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Track what you have. Never waste again.</Text>
      </View>
      <GlassCard>
        <Button testID="welcome-sign-in" label="Sign in" onPress={() => router.push('/(auth)/sign-in')} />
        <Button testID="welcome-sign-up" label="Create account" variant="secondary" onPress={() => router.push('/(auth)/sign-up')} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, marginTop: 32, marginBottom: 24 },
  title: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): welcome screen"
```

---

### Task H2: Sign-up screen (TDD with RNTL)

**Files:**
- Create: `apps/mobile/app/(auth)/sign-up.tsx`
- Create: `apps/mobile/app/(auth)/sign-up.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/app/(auth)/sign-up.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import SignUp from './sign-up';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useThemeStore, initThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { router } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<SignUp />', () => {
  beforeEach(async () => {
    __reset();
    vi.clearAllMocks();
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: true });
  });

  it('shows validation errors when fields are empty', async () => {
    const { getByTestId, findByText } = render(wrap(<SignUp />));
    fireEvent.press(getByTestId('sign-up-submit'));
    expect(await findByText(/required|invalid|at least/i)).toBeTruthy();
  });

  it('on success: stores tokens and routes to verify-email', async () => {
    queueFetch(
      jsonResponse({
        user: {
          id: 'u1', email: 'a@b.co', emailVerified: false, firstName: 'A', lastName: 'B',
          country: null, avatarUrl: null, role: 'user', status: 'active', themePreference: 'aurora',
          createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        },
        tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
      }, 201),
    );
    const { getByTestId, getByLabelText } = render(wrap(<SignUp />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    fireEvent.changeText(getByLabelText('First name'), 'A');
    fireEvent.changeText(getByLabelText('Last name'), 'B');
    await act(async () => {
      fireEvent.press(getByTestId('sign-up-submit'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('a'));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/verify-email');
  });

  it('on duplicate email: surfaces the error message', async () => {
    queueFetch(problemResponse('email_already_registered', 409, 'Email already registered'));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignUp />));
    fireEvent.changeText(getByLabelText('Email'), 'dupe@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    fireEvent.changeText(getByLabelText('First name'), 'A');
    fireEvent.changeText(getByLabelText('Last name'), 'B');
    await act(async () => {
      fireEvent.press(getByTestId('sign-up-submit'));
    });
    expect(await findByText('Email already registered')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run app/(auth)/sign-up.test.tsx
```

- [ ] **Step 3: Write `apps/mobile/app/(auth)/sign-up.tsx`**

```tsx
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { registerSchema } from '@pantry/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function SignUp() {
  const router = useRouter();
  const theme = useTheme();
  const signIn = useSessionStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const input = { email, password, firstName, lastName };
    const errs = fieldErrors(registerSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.register(input);
      await signIn(result);
      router.replace('/(auth)/verify-email');
    } catch (e) {
      setFormError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Create your account</Text>
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} error={errors.email} />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
      <TextField label="First name" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} error={errors.lastName} />
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button testID="sign-up-submit" label="Create account" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run app/(auth)/sign-up.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): sign-up screen with validation, register, route to verify"
```

---

### Task H3: Sign-in screen (TDD with RNTL)

**Files:**
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/app/(auth)/sign-in.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import SignIn from './sign-in';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { router } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

const USER = {
  id: 'u1', email: 'a@b.co', emailVerified: true, firstName: 'A', lastName: 'B',
  country: null, avatarUrl: null, role: 'user' as const, status: 'active' as const, themePreference: 'aurora' as const,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<SignIn />', () => {
  beforeEach(async () => {
    __reset();
    vi.clearAllMocks();
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: true });
  });

  it('on success: signs in and routes to home', async () => {
    queueFetch(jsonResponse({ user: USER, tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } }));
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('a'));
    expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)/home');
  });

  it('on invalid credentials: surfaces an error', async () => {
    queueFetch(problemResponse('invalid_credentials', 401, 'Invalid email or password'));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(await findByText('Invalid email or password')).toBeTruthy();
  });

  it('on email_not_verified: routes to verify-email', async () => {
    queueFetch(problemResponse('email_not_verified', 403, 'Verify your email first'));
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(auth)/verify-email'));
  });

  it('on TOTP challenge: surfaces the admin-web hint and does not sign in', async () => {
    queueFetch(jsonResponse({ requiresTotp: true, challengeToken: 'tok-123' }));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'admin@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(await findByText(/admin TOTP/i)).toBeTruthy();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(router.replace).not.toHaveBeenCalledWith('/(app)/(tabs)/home');
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run app/(auth)/sign-in.test.tsx
```

- [ ] **Step 3: Write `apps/mobile/app/(auth)/sign-in.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { loginSchema } from '@pantry/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { ApiError, isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';
import { signInWithGoogle, GoogleSignInCancelled } from '../../src/auth/google';
import { isAppleSignInAvailable, signInWithApple } from '../../src/auth/apple';
import { signInWithPasskey } from '../../src/auth/passkey';

export default function SignIn() {
  const router = useRouter();
  const theme = useTheme();
  const signIn = useSessionStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  function handleApiError(e: unknown) {
    if (isApiError(e)) {
      if (e.code === 'email_not_verified') {
        router.push('/(auth)/verify-email');
        return;
      }
      setFormError(e.title);
    } else {
      setFormError('Something went wrong');
    }
  }

  async function onSubmit() {
    setFormError(null);
    const input = { email, password };
    const errs = fieldErrors(loginSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.login(input);
      if ('requiresTotp' in result) {
        // Mobile users hitting this means they have an admin account —
        // route them to the admin web app for the TOTP step.
        setFormError('This account requires admin TOTP; please sign in via the admin web.');
        return;
      }
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setFormError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const result = await authEndpoints.oauthGoogle(idToken);
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      if (e instanceof GoogleSignInCancelled) return;
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onApple() {
    setFormError(null);
    setLoading(true);
    try {
      const cred = await signInWithApple();
      const result = await authEndpoints.oauthApple(cred.identityToken, cred.firstName, cred.lastName);
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onPasskey() {
    setFormError(null);
    setLoading(true);
    try {
      const result = await signInWithPasskey(email || undefined);
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Welcome back</Text>
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} error={errors.email} />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button testID="sign-in-submit" label="Sign in" onPress={onSubmit} loading={loading} />
      <Button label="Forgot password?" variant="ghost" onPress={() => router.push('/(auth)/forgot-password')} />
      <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 8 }}>or continue with</Text>
      <Button testID="sign-in-google" label="Continue with Google" variant="secondary" onPress={onGoogle} />
      {appleAvailable && Platform.OS === 'ios' ? (
        <Button testID="sign-in-apple" label="Continue with Apple" variant="secondary" onPress={onApple} />
      ) : null}
      <Button testID="sign-in-passkey" label="Use a passkey" variant="ghost" onPress={onPasskey} />
    </Screen>
  );
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run app/(auth)/sign-in.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): sign-in screen with password, google, apple, passkey"
```

---

### Task H4: Verify-email screen

**Files:**
- Create: `apps/mobile/app/(auth)/verify-email.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(auth)/verify-email.tsx`**

```tsx
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function VerifyEmail() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const params = useLocalSearchParams<{ token?: string }>();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!user?.email) {
      setError('No email on file');
      return;
    }
    setLoading(true);
    try {
      await authEndpoints.resendVerification(user.email);
      setMessage('Verification email sent. Check your inbox.');
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Verify your email</Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
        {params.token
          ? `We received a verification link. Open it on this device to finish signing up.`
          : `We sent a verification link to ${user?.email ?? 'your inbox'}. Tap it on this device to continue.`}
      </Text>
      {message ? <Text style={{ color: theme.colors.success }}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="verify-resend" label="Resend email" onPress={onResend} loading={loading} />
      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/(auth)/sign-in')} />
    </Screen>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): verify-email screen with resend"
```

---

### Task H5: Forgot-password screen

**Files:**
- Create: `apps/mobile/app/(auth)/forgot-password.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(auth)/forgot-password.tsx`**

```tsx
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { forgotPasswordSchema } from '@pantry/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function ForgotPassword() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const errs = fieldErrors(forgotPasswordSchema, { email });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await authEndpoints.forgotPassword(email);
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>Check your inbox</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          If an account exists for {email}, we sent a reset link.
        </Text>
        <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Forgot password?</Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Enter your email and we'll send a reset link.
      </Text>
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} error={errors.email} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="forgot-submit" label="Send reset link" onPress={onSubmit} loading={loading} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): forgot-password screen"
```

---

### Task H6: Reset-password screen

**Files:**
- Create: `apps/mobile/app/(auth)/reset-password.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(auth)/reset-password.tsx`**

```tsx
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { resetPasswordSchema } from '@pantry/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function ResetPassword() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const token = params.token ?? '';
    const errs = fieldErrors(resetPasswordSchema, { token, password });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await authEndpoints.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>Password reset</Text>
        <Text style={{ color: theme.colors.textMuted }}>Sign in with your new password.</Text>
        <Button label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Choose a new password</Text>
      {!params.token ? <ErrorText>This link is missing its token. Request a new one.</ErrorText> : null}
      <TextField label="New password" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="reset-submit" label="Save password" onPress={onSubmit} loading={loading} disabled={!params.token} />
    </Screen>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(mobile): reset-password screen with deep-link token"
```

---

## Phase I — App shell (tabs) + settings/theme

### Task I1: Tab stubs

**Files:**
- Create: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/browse.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/reviews.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/profile.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(app)/(tabs)/home.tsx`**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';

export default function Home() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>
        Hello{user?.firstName ? `, ${user.firstName}` : ''}
      </Text>
      <GlassCard>
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>Your pantry will appear here.</Text>
        <Text style={{ color: theme.colors.textMuted }}>M1 will fill this in with records.</Text>
      </GlassCard>
    </Screen>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/app/(app)/(tabs)/browse.tsx`**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

export default function Browse() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Browse</Text>
      <Text style={{ color: theme.colors.textMuted }}>M1 will fill this in with the product catalog.</Text>
    </Screen>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/app/(app)/(tabs)/reviews.tsx`**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

export default function Reviews() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Reviews</Text>
      <Text style={{ color: theme.colors.textMuted }}>M2 will fill this in with reviews and votes.</Text>
    </Screen>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/app/(app)/(tabs)/profile.tsx`**

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';
import { authEndpoints } from '../../../src/api/endpoints';

export default function Profile() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  async function onSignOut() {
    try { await authEndpoints.logout(); } catch { /* best-effort */ }
    await signOut();
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Profile</Text>
      <Card>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>{user?.email}</Text>
      </Card>
      <View style={{ gap: 8 }}>
        <Button testID="profile-theme" label="Theme" variant="secondary" onPress={() => router.push('/(app)/settings/theme')} />
        <Button testID="profile-sign-out" label="Sign out" variant="danger" onPress={onSignOut} />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): tab stubs (home, browse, reviews, profile)"
```

---

### Task I2: Settings → Theme screen with four preview cards

**Files:**
- Create: `apps/mobile/app/(app)/settings/theme.tsx`
- Create: `apps/mobile/app/(app)/settings/theme.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/app/(app)/settings/theme.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react-native';
import ThemeSettings from './theme';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../../src/theme/store';
import { __reset } from '../../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<ThemeSettings />', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'aurora', hydrated: false });
    await initThemeStore();
  });

  it('renders a card for each of the four themes', () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    expect(getByTestId('theme-card-aurora')).toBeTruthy();
    expect(getByTestId('theme-card-bento')).toBeTruthy();
    expect(getByTestId('theme-card-clay')).toBeTruthy();
    expect(getByTestId('theme-card-material')).toBeTruthy();
  });

  it('tapping a card sets the active theme in the store', async () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    await act(async () => {
      fireEvent.press(getByTestId('theme-card-clay'));
    });
    expect(useThemeStore.getState().themeId).toBe('clay');
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile exec vitest run "app/(app)/settings/theme.test.tsx"
```

- [ ] **Step 3: Write `apps/mobile/app/(app)/settings/theme.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { themeList, type Theme } from '@pantry/theme';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { useThemeStore } from '../../../src/theme/store';

export default function ThemeSettings() {
  const active = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '700', color: active.colors.text }}>Theme</Text>
      <Text style={{ color: active.colors.textMuted, marginBottom: 8 }}>Tap a card to switch instantly.</Text>
      <View style={styles.grid}>
        {themeList.map((t) => (
          <ThemePreviewCard key={t.id} theme={t} selected={t.id === active.id} onPress={() => setTheme(t.id)} />
        ))}
      </View>
    </Screen>
  );
}

function ThemePreviewCard({ theme, selected, onPress }: { theme: Theme; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={`theme-card-${theme.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Select ${theme.name} theme`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.lg,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.swatchRow]}>
        <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.accent }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderWidth: 1 }]} />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{theme.name}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{theme.scheme === 'dark' ? 'Dark' : 'Light'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', padding: 14, gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 6 },
});
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile exec vitest run "app/(app)/settings/theme.test.tsx"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): settings/theme with four-card preview switcher"
```

---

## Phase J — End-to-end + CI

### Task J1: Maestro E2E happy path

**Files:**
- Create: `apps/mobile/tests/e2e/sign-up-and-sign-in.yaml`

- [ ] **Step 1: Write `apps/mobile/tests/e2e/sign-up-and-sign-in.yaml`**

```yaml
# Maestro flow: sign up → land on verify-email → resend → return to sign in → sign in → land on home.
# Requires the API to be running locally and the dev client to be installed.
appId: com.pantry.app
---
- launchApp
- assertVisible: "Pantry"
- tapOn:
    id: "welcome-sign-up"
- assertVisible: "Create your account"
- tapOn:
    text: "Email"
- inputText: "maestro+${RANDOM}@pantry.test"
- tapOn:
    text: "Password"
- inputText: "correct-horse-battery-staple"
- tapOn:
    text: "First name"
- inputText: "Maestro"
- tapOn:
    text: "Last name"
- inputText: "Tester"
- tapOn:
    id: "sign-up-submit"
- assertVisible: "Verify your email"
- tapOn:
    id: "verify-resend"
- assertVisible:
    text: "Verification email sent"
- tapOn:
    text: "Back to sign in"
- assertVisible: "Welcome back"
- tapOn:
    text: "Email"
- inputText: "${OUTPUT.email}"
- tapOn:
    text: "Password"
- inputText: "correct-horse-battery-staple"
- tapOn:
    id: "sign-in-submit"
# Happy path lands on Home (or Verify if API still requires verification — both are acceptable here).
- assertVisible:
    text: "Hello"
```

- [ ] **Step 2: Commit (Maestro itself runs in CI as a TODO; see J3)**

```bash
git add -A
git commit -m "test(mobile): maestro sign-up to sign-in happy path"
```

---

### Task J2: Full mobile test run

- [ ] **Step 1: Run every mobile Vitest spec**

```bash
pnpm --filter @pantry/mobile test
```
Expected: every file passes. As of M0c, the suite is:

- `src/auth/secure-store.test.ts` — 4 tests
- `src/api/errors.test.ts` — 2 tests
- `src/api/client.test.ts` — 11 tests
- `src/theme/store.test.ts` — 4 tests
- `src/theme/ThemeProvider.test.tsx` — 4 tests
- `src/theme/sync.test.ts` — 3 tests
- `src/auth/session-store.test.ts` — 4 tests
- `src/lib/validate.test.ts` — 2 tests
- `src/lib/linking.test.ts` — 4 tests
- `app/(auth)/sign-up.test.tsx` — 3 tests
- `app/(auth)/sign-in.test.tsx` — 4 tests
- `app/(app)/settings/theme.test.tsx` — 2 tests

- [ ] **Step 2: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: exit 0 for every workspace package.

- [ ] **Step 3: No commit (verification only)**

---

### Task J3: CI workflow — mobile lint + tests on PRs, Maestro nightly TODO

**Files:**
- Create: `.github/workflows/ci.yml`

> M0a does NOT ship `.github/workflows/ci.yml` — M0c creates it from scratch.

- [ ] **Step 1: Verify the file does not already exist**

```bash
test ! -f .github/workflows/ci.yml
```
Expected: exit 0 (file is absent). If the file exists, stop and investigate before overwriting — another milestone may have created it ahead of schedule.

- [ ] **Step 2: Create the directory if needed and write `.github/workflows/ci.yml` from scratch**

```bash
mkdir -p .github/workflows
```

Write the full file `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # 06:00 UTC nightly — used by Maestro job once enabled (M4)

jobs:
  mobile:
    name: Mobile (typecheck + tests)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Typecheck mobile
        run: pnpm --filter @pantry/mobile typecheck
      - name: Run mobile tests
        run: pnpm --filter @pantry/mobile test

  # TODO(M4): wire Maestro E2E on nightly schedule. EAS-managed Maestro setup
  # (build dev client, install on emulator, run flow) is non-trivial. A minimal
  # scripted invocation will live here once EAS credentials are provisioned.
  # mobile-e2e:
  #   name: Mobile E2E (Maestro)
  #   if: github.event_name == 'schedule'
  #   runs-on: macos-14
  #   steps:
  #     - uses: actions/checkout@v4
  #     - run: curl -Ls "https://get.maestro.mobile.dev" | bash
  #     - run: maestro test apps/mobile/tests/e2e
```

- [ ] **Step 3: Smoke check the file is syntactically valid YAML**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo ok
```
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(mobile): create ci.yml with typecheck + vitest on PRs; nightly Maestro TODO"
```

---

## Phase Z — Final verification

### Task Z1: Confirm the milestone is green

- [ ] **Step 1: Clean install from a cold cache**

```bash
pnpm install --frozen-lockfile
```

- [ ] **Step 2: Full typecheck**

```bash
pnpm typecheck
```
Expected: exit 0 for every workspace package.

- [ ] **Step 3: Full mobile test run**

```bash
pnpm --filter @pantry/mobile test
```
Expected: every spec passes. The expected files are listed in Task J2 Step 1.

- [ ] **Step 4: Expo dev boot probe**

```bash
pnpm --filter @pantry/mobile exec expo config --type prebuild >/dev/null
```
Expected: exits 0 (config is valid).

- [ ] **Step 5: Prettier**

```bash
pnpm exec prettier --check apps/mobile
```
Expected: exit 0. If not, run `pnpm exec prettier --write apps/mobile` and re-check.

- [ ] **Step 6: Confirm git history is clean**

```bash
git status
git log --oneline -40
```
Expected: working tree clean, all commits scoped `mobile` (or `ci(mobile)`) and following conventional commits.

- [ ] **Step 7: Tag the milestone**

```bash
git tag m0c-complete
```

---

## Self-review checklist (run before declaring M0c done)

- [ ] **Spec coverage** — every requirement is implemented:
  - §2.1 Authentication: email+password sign-up/sign-in/verify/forgot/reset ✓ (H2–H6), Google ✓ (G1+H3), Apple ✓ (G2+H3, iOS-gated), passkeys ✓ (G3+H3), tokens in `expo-secure-store` ✓ (B1).
  - §2.10 Theming: four themes, switcher, 200ms cross-fade, local persist + server sync ✓ (C1–C3, I2).
  - §6.1 Auth: every endpoint listed in scope is reachable via `authEndpoints` ✓ (B6).
  - §6.6 `PATCH /v1/me`: used for theme sync ✓ (C3, B6).
  - §7.1 Stack: Expo Router + Zustand + TanStack Query + NativeWind + `expo-secure-store` + social SDKs + passkey ✓ (A1–F1).
  - §7.2 Folder structure: matches `app/(auth)`, `app/(app)/(tabs)`, `app/(app)/settings/`, `src/api/`, `src/auth/`, `src/components/`, `src/theme/` ✓.
  - §7.5 Theme system: `useTheme()` backed by Zustand, 200ms cross-fade, persists to secure-store + syncs to server ✓ (C1–C3).
- [ ] **Placeholder scan** — no "TBD", "TODO" (except the explicit M4 Maestro TODO in CI), "fill in details", or "see Task N" exists in any code block above. Every step shows the actual code.
- [ ] **Type consistency** — function names match across tasks: `secureStore.setAccessToken/getAccessToken/clearAll`, `useSessionStore.signIn/signOut`, `useThemeStore.setTheme`, `initThemeStore`, `hydrateSession`, `apiClient.request`, `setOnSignOut`, `wireApiClient`, `signInWithGoogle/Apple/Passkey`, `authEndpoints.*`, `meEndpoints.update`, `parseAuthDeepLink`, `fieldErrors`. Schema imports are `registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema` — all real exports from `@pantry/shared` per M0a Task B2.
- [ ] **WatermelonDB** — install only; no models or sync engine. M1 will pick this up.
- [ ] **Only Aurora Glass is polished UI**, but theme provider + switcher work for all four token sets (verified by `theme.test.tsx` rendering each `themeId` and the settings screen rendering all four cards).
- [ ] **Mobile CI** runs lint (skip placeholder), typecheck, and Vitest on every PR. Maestro is documented as nightly-deferred per scope.

---

## Handoff to next milestones

- **M1 (Personal pantry)** picks up by:
  - Adding WatermelonDB models + sync engine in `apps/mobile/src/db/`.
  - Adding the scan camera flow at `app/(app)/scan.tsx`.
  - Filling in `home.tsx` and `browse.tsx` with real record + product UIs.
  - Adding country auto-detection on first launch using the M0a backend service.
  - Wiring push notifications and the `me/push-token` endpoint.
- **M2** fills `reviews.tsx`, `product/[id].tsx`, and the review/vote flow.
- **M4** ships Bento / Soft Clay / Material You per-screen polish, enables the Maestro CI job, and finishes the EAS production profile in `eas.json`.
