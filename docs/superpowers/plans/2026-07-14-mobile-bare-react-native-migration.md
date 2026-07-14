# Expyrico Bare React Native Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every active Expo runtime/build dependency from Expyrico, preserve the redesigned mobile experience in a bare React Native 0.76.9 Android/iOS application, and replace the Expo Push pipeline with native FCM delivery.

**Architecture:** A standard `AppRegistry` entry mounts the existing providers around typed React Navigation auth, tab, and app stacks. Platform adapters isolate configuration, secure/persistent storage, camera, authentication, and FCM. Android and a newly generated iOS host autolink those adapters; the API uses Firebase Admin and a forward Prisma migration for native device tokens.

**Tech Stack:** React Native 0.76.9, React 18.3.1, Community CLI 15.0.0, React Navigation 7, Zustand, TanStack Query, Keychain 9.2.3, Async Storage 3.1.1, Vision Camera 4.7.2, React Native Firebase 21.12.0, Firebase Admin 13.5.0, React Native Config 1.6.0, Jest 29, Vitest, Gradle/ADB, CocoaPods/Xcode.

**Spec:** `docs/superpowers/specs/2026-07-14-mobile-bare-react-native-migration-design.md`

---

## Execution assumptions

- Work in `.worktrees/mobile-no-expo-plan` on `codex/mobile-no-expo-plan`.
- Keep the old Expo packages installed only until their last imports are replaced. Remove them together with the Android/tooling switch in Task 13 so the first bare native build cannot autolink stale modules.
- The first bare build intentionally requires one sign-in because the old encrypted store is not reimplemented. Theme falls back to System; referral/sync/push flags start clean.
- Existing production push tokens are revoked during the FCM cutover and devices re-register after authentication.
- Firebase client configuration and service-account credentials remain outside Git. Unit/integration tests mock Firebase. Real push delivery verification requires securely supplied `google-services.json`, `GoogleService-Info.plist`, and Application Default Credentials.
- The current local release APK may remain debug-signed for emulator verification. Production upload signing is a separate credential-controlled release operation.

## File responsibility map

| Unit | Files | Responsibility |
| --- | --- | --- |
| Entry/bootstrap | `apps/mobile/index.js`, `apps/mobile/app.json`, `apps/mobile/src/App.tsx` | Register the app, hydrate stores, wire providers, start authenticated services, render bootstrap/error states |
| Navigation | `apps/mobile/src/navigation/*` | Typed auth/app/tab stacks, tab bar, route names, referral URL capture |
| Runtime config | `apps/mobile/src/config/runtime.ts` | Validate API/OAuth values supplied by native build configuration |
| Persistence | `apps/mobile/src/auth/secure-store.ts`, `apps/mobile/src/storage/persistent-store.ts` | Keychain credentials and Async Storage non-secrets |
| Camera | `apps/mobile/src/features/scan/*`, `apps/mobile/src/features/expiry/OcrCamera.tsx` | Permission, barcode/QR scan, photo capture for OCR |
| Push client | `apps/mobile/src/features/push/*`, `apps/mobile/src/api/push.ts` | Permission, FCM token lifecycle, registration/revocation |
| Push server | `packages/shared/src/schemas/record.ts`, `api/src/services/push/*`, `api/src/workers/notification-send.ts` | Native token contract, FCM delivery, invalid-token handling |
| Native Android | `apps/mobile/android/**` | Standard React Native host, Gradle bundling/autolinking, splash, Firebase/Vision Camera configuration |
| Native iOS | `apps/mobile/ios/**` | Standard React Native host, pods, capabilities, assets, privacy and launch resources |
| Tooling/docs | mobile Babel/Metro/Jest/TS configs, CI, active docs | Non-Expo builds/tests and local Gradle/ADB workflow |

### Task 1: Establish a verified baseline and integrate the Welcome control fix

**Files:**
- Modify through cherry-pick: `apps/mobile/src/components/Button.tsx`
- Modify through cherry-pick: `apps/mobile/tests/snapshots/welcome.test.tsx`

- [ ] **Step 1: Confirm the worktree and clean state**

Run:

```bash
git branch --show-current
git status --short
```

Expected: branch is `codex/mobile-no-expo-plan` and status is clean because the reviewed spec and plan are already committed.

- [ ] **Step 2: Install the frozen baseline in this worktree**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: this worktree has its own dependency links and the lockfile remains unchanged.

- [ ] **Step 3: Integrate the already reviewed Welcome fix**

Run:

```bash
git cherry-pick c083f7b
```

Expected: commit `fix(mobile): constrain welcome action buttons` applies without conflict.

- [ ] **Step 4: Run and record the baseline checks**

Run:

```bash
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile test -- --runInBand
pnpm --filter @expyrico/api typecheck
pnpm --filter @expyrico/shared build
```

Expected: type/build checks pass and Jest reports the current passing baseline. If full mobile lint still reports pre-existing findings, save the exact count in the task notes; every touched file must be clean and Task 16 requires the full command to pass.

### Task 2: Add bare-runtime dependencies and validated configuration

**Files:**
- Modify: root `package.json`
- Modify: root `.gitignore`
- Modify: `apps/mobile/package.json`
- Modify: `api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/mobile/.env.example`
- Create: `apps/mobile/src/config/runtime.ts`
- Create: `apps/mobile/src/config/runtime.test.ts`
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/api/client.test.ts`
- Modify: `apps/mobile/src/auth/google.ts`

- [ ] **Step 1: Write failing runtime-configuration tests**

Create `apps/mobile/src/config/runtime.test.ts`:

```ts
const load = (values: Record<string, string | undefined>) => {
  jest.resetModules();
  jest.doMock('react-native-config', () => values);
  return require('./runtime') as typeof import('./runtime');
};

describe('runtimeConfig', () => {
  it('normalizes the API base URL', () => {
    const { runtimeConfig } = load({ API_BASE_URL: 'https://api.expyrico.test/' });
    expect(runtimeConfig.apiBaseUrl).toBe('https://api.expyrico.test');
  });

  it('fails fast when API_BASE_URL is absent', () => {
    expect(() => load({})).toThrow('API_BASE_URL');
  });

  it('keeps optional identity configuration undefined', () => {
    const { runtimeConfig } = load({ API_BASE_URL: 'https://api.expyrico.test' });
    expect(runtimeConfig.googleWebClientId).toBeUndefined();
  });

  it('treats blank optional identity values as unset', () => {
    const { runtimeConfig } = load({
      API_BASE_URL: 'https://api.expyrico.test',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    });
    expect(runtimeConfig.googleWebClientId).toBeUndefined();
    expect(runtimeConfig.googleIosClientId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
pnpm --filter @expyrico/mobile exec jest src/config/runtime.test.ts --runInBand
```

Expected: FAIL because `src/config/runtime.ts` does not exist.

- [ ] **Step 3: Install the exact compatibility baseline without removing old packages yet**

Run:

```bash
pnpm --filter @expyrico/mobile add @react-navigation/native@7.3.8 @react-navigation/native-stack@7.17.10 @react-native-async-storage/async-storage@3.1.1 react-native-keychain@9.2.3 react-native-vision-camera@4.7.2 @react-native-firebase/app@21.12.0 @react-native-firebase/messaging@21.12.0 @invertase/react-native-apple-authentication@2.5.1 react-native-vector-icons@10.3.0 react-native-config@1.6.0
pnpm --filter @expyrico/mobile add -D @react-native/babel-preset@0.76.9 @react-native/metro-config@0.76.9
pnpm add -Dw @react-native-community/cli@15.0.0 @react-native-community/cli-platform-android@15.0.0 @react-native-community/cli-platform-ios@15.0.0
pnpm --filter @expyrico/api add firebase-admin@13.5.0
```

Expected: the root CLI and both platform packages all resolve to 15.0.0, the supported line for React Native 0.76; no root 13.x CLI remains. `expo` may still be present because removal is deferred to Task 13.

- [ ] **Step 4: Implement the validated config boundary**

Create `apps/mobile/src/config/runtime.ts`:

```ts
import Config from 'react-native-config';
import { z } from 'zod';

const schema = z.object({
  API_BASE_URL: z.string().url(),
  GOOGLE_WEB_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  GOOGLE_IOS_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
});

const parsed = schema.parse(Config);

export const runtimeConfig = Object.freeze({
  apiBaseUrl: parsed.API_BASE_URL.replace(/\/+$/, ''),
  googleWebClientId: parsed.GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: parsed.GOOGLE_IOS_CLIENT_ID,
});
```

Create `apps/mobile/.env.example`:

```dotenv
# Reserved non-routable domain: compile/launch smoke only, never acceptance traffic.
API_BASE_URL=https://api.expyrico.invalid
GOOGLE_WEB_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_IOS_URL_SCHEME=
PASSKEY_ASSOCIATED_DOMAIN=
```

Before any native credential is provisioned, add these entries to root `.gitignore`:

```gitignore
apps/mobile/.env.mobile.local
apps/mobile/ios/tmp.xcconfig
apps/mobile/ios/GoogleService-Info.plist
apps/mobile/android/app/google-services.json
*.firebase-admin.json
```

Use the committed `.env.example` only for credential-free compile and non-network launch checks (`ENVFILE=.env.example`); its `.invalid` host must never be replaced with a live endpoint in Git. For isolated local acceptance or real Google/passkey verification, copy it to the ignored `.env.mobile.local`, set an explicitly reviewed local/staging API URL plus only public mobile client/configuration values, and build with `ENVFILE=.env.mobile.local`. Firebase Admin credentials must live outside the repository entirely and be referenced by `GOOGLE_APPLICATION_CREDENTIALS`.

Update `getBaseUrl()` in `apps/mobile/src/api/client.ts` to return `runtimeConfig.apiBaseUrl`, and update `apps/mobile/src/auth/google.ts` to read the two Google client IDs from `runtimeConfig`. Remove both `expo-constants` imports. Do not carry forward `passkeyRpId`: passkey request/creation options already come from the authenticated API, so the client-side value is unused.

- [ ] **Step 5: Pass config and API client tests**

Run:

```bash
pnpm --filter @expyrico/mobile exec jest src/config/runtime.test.ts src/api/client.test.ts --runInBand
pnpm --filter @expyrico/mobile typecheck
```

Expected: PASS; no source import of `expo-constants` remains.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json apps/mobile/.env.example apps/mobile/package.json apps/mobile/src/config apps/mobile/src/api/client.ts apps/mobile/src/api/client.test.ts apps/mobile/src/auth/google.ts api/package.json pnpm-lock.yaml
git commit -m "build(mobile): add bare runtime dependencies"
```

### Task 3: Define the typed navigation and referral contracts

**Files:**
- Create: `apps/mobile/src/navigation/types.ts`
- Create: `apps/mobile/src/navigation/referralLinks.ts`
- Create: `apps/mobile/src/navigation/referralLinks.test.ts`
- Create: `apps/mobile/src/navigation/navigationRef.ts`

- [ ] **Step 1: Write failing referral parser tests**

Create `apps/mobile/src/navigation/referralLinks.test.ts`:

```ts
import { referralCodeFromUrl } from './referralLinks';

describe('referralCodeFromUrl', () => {
  it('extracts and normalizes a supported invite code', () => {
    expect(referralCodeFromUrl('expyrico://invite?code=abcdEF23')).toBe('ABCDEF23');
  });

  it.each([
    'https://example.com/invite?code=ABCDEF23',
    'expyrico://record/123',
    'expyrico://invite?code=BAD!',
    'expyrico://invite',
  ])('rejects unsupported or invalid URL %s', (url) => {
    expect(referralCodeFromUrl(url)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure**

Run:

```bash
pnpm --filter @expyrico/mobile exec jest src/navigation/referralLinks.test.ts --runInBand
```

Expected: FAIL because the module is absent.

- [ ] **Step 3: Add the exact route types**

Create `apps/mobile/src/navigation/types.ts`:

```ts
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ReportTargetType } from '@expyrico/shared';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  VerifyEmail: { email?: string };
  ForgotPassword: undefined;
  VerifyResetCode: { email?: string };
  ResetPassword: { ticket?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Giveaways: undefined;
  Deals: undefined;
  Browse: undefined;
  Reviews: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Scan: undefined;
  ProductDetail: { id: string };
  ProductReview: { id: string };
  ProductNew: { barcode?: string; qr?: string };
  RecordDetail: { id: string };
  DealDetail: { id: string };
  DealEditor: { editId?: string };
  GiveawayDetail: { id: string };
  GiveawayManage: { id: string };
  GiveawayRate: { id: string };
  GiveawayMine: undefined;
  GiveawayNew: undefined;
  Household: undefined;
  Invite: undefined;
  Report: { targetType: ReportTargetType; targetId: string };
  Settings: undefined;
  ThemeSettings: undefined;
  AddPasskey: undefined;
  NotificationSettings: undefined;
  AccountSettings: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};
```

- [ ] **Step 4: Implement referral parsing and a navigation ref**

Create `apps/mobile/src/navigation/referralLinks.ts`:

```ts
const CODE = /^[A-Z2-9]{8}$/;

export function referralCodeFromUrl(url: string): string | null {
  const match = /^expyrico:\/\/invite\?(?:[^#]*&)?code=([^&#]+)(?:&[^#]*)?$/i.exec(url);
  if (!match?.[1]) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return null;
  }
  return CODE.test(decoded) ? decoded : null;
}
```

Create `apps/mobile/src/navigation/navigationRef.ts`:

```ts
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @expyrico/mobile exec jest src/navigation/referralLinks.test.ts --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/navigation
git commit -m "feat(mobile): define typed navigation contract"
```

Expected: tests and typecheck pass.

### Task 4: Build the React Navigation shell and app bootstrap

**Files:**
- Create: `apps/mobile/src/navigation/AuthNavigator.tsx`
- Create: `apps/mobile/src/navigation/AppNavigator.tsx`
- Create: `apps/mobile/src/navigation/MainTabsNavigator.tsx`
- Create: `apps/mobile/src/navigation/FloatingTabBar.tsx`
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/__tests__/app-bootstrap.test.tsx`
- Modify: `apps/mobile/tests/helpers/renderWithTheme.tsx`

- [ ] **Step 1: Replace the splash lifecycle test with failing bootstrap behavior tests**

Create `apps/mobile/__tests__/app-bootstrap.test.tsx` with deferred hydration controls and these assertions:

```tsx
let resolveThemeHydration!: () => void;
let resolveSessionHydration!: () => void;
let rejectThemeHydration!: (error: Error) => void;
let themeStore!: { setState: (state: { hydrated: boolean }) => void };
let sessionStore!: { setState: (state: { hydrated: boolean; accessToken: null }) => void };

jest.mock('../src/theme/store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useThemeStore = create<{ hydrated: boolean }>(() => ({ hydrated: false }));
  themeStore = useThemeStore;
  return {
    useThemeStore,
    initThemeStore: () => new Promise<void>((resolve, reject) => {
      resolveThemeHydration = () => {
        useThemeStore.setState({ hydrated: true });
        resolve();
      };
      rejectThemeHydration = reject;
    }),
  };
});

jest.mock('../src/auth/session-store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useSessionStore = create<{ hydrated: boolean; accessToken: null }>(() => ({
    hydrated: false,
    accessToken: null,
  }));
  sessionStore = useSessionStore;
  return {
    useSessionStore,
    hydrateSession: () => new Promise<void>((resolve) => {
      resolveSessionHydration = () => {
        useSessionStore.setState({ hydrated: true });
        resolve();
      };
    }),
  };
});

beforeEach(() => {
  themeStore.setState({ hydrated: false });
  sessionStore.setState({ hydrated: false, accessToken: null });
});

it('keeps an in-app bootstrap overlay until both stores hydrate', async () => {
  const screen = render(<App />);
  expect(screen.getByTestId('app-bootstrap')).toBeTruthy();
  await act(async () => {
    resolveThemeHydration();
    resolveSessionHydration();
  });
  await waitFor(() => expect(screen.queryByTestId('app-bootstrap')).toBeNull());
});

it('shows a recoverable startup error when hydration fails', async () => {
  const screen = render(<App />);
  await act(async () => rejectThemeHydration(new Error('storage unavailable')));
  expect(await screen.findByText('Unable to start Expyrico')).toBeTruthy();
});
```

- [ ] **Step 2: Verify failure**

Run:

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/app-bootstrap.test.tsx --runInBand
```

Expected: FAIL because `src/App.tsx` is absent.

- [ ] **Step 3: Implement navigator composition**

`AuthNavigator.tsx` registers all seven auth screens with `headerShown: false`:

```tsx
<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Welcome" component={WelcomeScreen} />
  <Stack.Screen name="SignIn" component={SignInScreen} />
  <Stack.Screen name="SignUp" component={SignUpScreen} />
  <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
  <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
  <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
</Stack.Navigator>
```

`MainTabsNavigator.tsx` registers `Home`, `Giveaways`, `Deals`, `Browse`, `Reviews`, and `Profile`, and uses the floating bar extracted from the old tab layout. `AppNavigator.tsx` registers every `AppStackParamList` key in the order listed in `types.ts`; Settings, ThemeSettings, AddPasskey, NotificationSettings, and AccountSettings use visible native-stack headers, while the remaining screens retain their current header behavior.

Use this root switch in `RootNavigator.tsx`:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '../auth/session-store';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const accessToken = useSessionStore((state) => state.accessToken);
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {accessToken ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 4: Implement provider/bootstrap behavior**

Create `apps/mobile/src/App.tsx` with the provider order below. Use React Native `Linking.getInitialURL()` and `Linking.addEventListener('url', ...)`, pass accepted invite codes to `capturePendingReferralCode`, and start sync triggers only while authenticated.

```tsx
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AppBootstrap />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Retain the current module-level `react-native-get-random-values` and `global.css` imports and the 1.5 `Text`/`TextInput` maximum font multiplier. Implement `AppBootstrap` with this control flow (use the existing theme token names rather than literal colors):

```tsx
function AppBootstrap() {
  const [bootError, setBootError] = useState<string | null>(null);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const accessToken = useSessionStore((state) => state.accessToken);
  const theme = useTheme();

  useEffect(() => {
    wireApiClient();
    void Promise.all([initThemeStore(), hydrateSession()]).catch((error) => {
      setBootError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    startSyncTriggers();
    return () => stopSyncTriggers();
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    const capture = (url: string | null) => {
      if (!active || !url) return;
      const code = referralCodeFromUrl(url);
      if (code) void capturePendingReferralCode(code);
    };
    void Linking.getInitialURL().then(capture);
    const subscription = Linking.addEventListener('url', ({ url }) => capture(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const booting = !bootError && (!themeHydrated || !sessionHydrated);
  return (
    <>
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <RootNavigator />
      {booting ? (
        <View
          testID="app-bootstrap"
          style={[styles.overlay, { backgroundColor: theme.colors.bg }]}
        >
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : bootError ? (
        <View style={[styles.overlay, { backgroundColor: theme.colors.bg }]}>
          <Text style={{ color: theme.colors.text }}>Unable to start Expyrico</Text>
          <Text style={{ color: theme.colors.textMuted }}>Please close and reopen the app.</Text>
        </View>
      ) : null}
    </>
  );
}
```

`styles.overlay` is `StyleSheet.absoluteFillObject` plus centered alignment and 24-point padding. Always mount `RootNavigator` under the overlay so navigation is ready when hydration completes. Do not call a native splash module. Tests additionally cover initial invite URL, runtime invite URL, listener cleanup, authenticated sync start/stop, and token-controlled Auth/App root selection.

- [ ] **Step 5: Pass focused tests and commit**

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/app-bootstrap.test.tsx src/navigation --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/App.tsx apps/mobile/src/navigation apps/mobile/__tests__/app-bootstrap.test.tsx apps/mobile/tests/helpers/renderWithTheme.tsx
git commit -m "feat(mobile): add bare navigation shell"
```

### Task 5: Migrate every authentication route and route test

**Files:**
- Modify: `apps/mobile/app/(auth)/welcome.tsx`
- Modify: `apps/mobile/app/(auth)/sign-in.tsx`
- Modify: `apps/mobile/app/(auth)/sign-up.tsx`
- Modify: `apps/mobile/app/(auth)/verify-email.tsx`
- Modify: `apps/mobile/app/(auth)/forgot-password.tsx`
- Modify: `apps/mobile/app/(auth)/verify-reset-code.tsx`
- Modify: `apps/mobile/app/(auth)/reset-password.tsx`
- Modify: `apps/mobile/src/components/AuthBackButton.tsx`
- Create: `apps/mobile/tests/helpers/renderWithNavigation.tsx`
- Modify: `apps/mobile/__tests__/routes/sign-in.test.tsx`
- Modify: `apps/mobile/__tests__/routes/sign-up.test.tsx`
- Modify: `apps/mobile/__tests__/routes/verify-email.test.tsx`
- Modify: `apps/mobile/__tests__/routes/forgot-password.test.tsx`
- Modify: `apps/mobile/__tests__/routes/verify-reset-code.test.tsx`
- Modify: `apps/mobile/__tests__/routes/reset-password.test.tsx`

- [ ] **Step 1: Create a real-navigation test helper**

Create `apps/mobile/tests/helpers/renderWithNavigation.tsx`:

```tsx
import {
  NavigationContainer,
  createNavigationContainerRef,
  type InitialState,
} from '@react-navigation/native';
import { renderWithTheme } from './renderWithTheme';
import { AuthNavigator } from '../../src/navigation/AuthNavigator';
import { AppNavigator } from '../../src/navigation/AppNavigator';
import type { AuthStackParamList, AppStackParamList } from '../../src/navigation/types';

export function renderAuthNavigation<Name extends keyof AuthStackParamList>(
  name: Name,
  params: AuthStackParamList[Name],
) {
  const navigationRef = createNavigationContainerRef<AuthStackParamList>();
  const screen = renderWithTheme(
    <NavigationContainer
      ref={navigationRef}
      initialState={{ index: 0, routes: [{ name, params }] }}
    >
      <AuthNavigator />
    </NavigationContainer>,
    'expyrico',
  );
  return { ...screen, navigationRef };
}

export function renderAuthenticatedNavigation(initialState?: InitialState) {
  const navigationRef = createNavigationContainerRef<AppStackParamList>();
  const screen = renderWithTheme(
    <NavigationContainer ref={navigationRef} initialState={initialState}>
      <AppNavigator />
    </NavigationContainer>,
    'expyrico',
  );
  return { ...screen, navigationRef };
}
```

Tests assert `navigationRef.getCurrentRoute()` rather than mocked path calls.

- [ ] **Step 2: Convert the Sign-up test first and verify failure**

Change its success assertion from the Router mock to:

```ts
const { navigationRef } = renderAuthNavigation('SignUp', undefined);
await waitFor(() => {
  expect(navigationRef.getCurrentRoute()).toMatchObject({
    name: 'VerifyEmail',
    params: { email: 'dan@example.com' },
  });
});
```

Run:

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/routes/sign-up.test.tsx --runInBand
```

Expected: FAIL until the screen uses React Navigation.

- [ ] **Step 3: Apply the exact route conversion map**

Use the exact screen type in each module, for example `NativeStackScreenProps<AuthStackParamList, 'SignUp'>` in Sign-up and `NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>` in Verify email. Replace calls exactly as follows:

```text
Welcome: /(auth)/sign-up -> SignUp; /(auth)/sign-in -> SignIn
SignIn: verify-email(email) -> VerifyEmail; forgot-password -> ForgotPassword
SignUp: verify-email(email) -> VerifyEmail
VerifyEmail: sign-up -> SignUp; sign-in -> SignIn
ForgotPassword: verify-reset-code(email) -> VerifyResetCode; cancel -> goBack()
VerifyResetCode: reset-password(ticket) -> ResetPassword; change email -> ForgotPassword
ResetPassword: success/change ticket -> SignIn or ForgotPassword
```

Read params only from `route.params`. Successful sign-in and email verification call the existing session-store `signIn`; the access-token change makes `RootNavigator` replace the auth tree with `App/MainTabs/Home`, so nested auth screens must not try to navigate into the root stack. Replace `AuthBackButton`’s path fallback with a typed `fallback: keyof AuthStackParamList` and call `navigation.navigate(fallback)` only when `canGoBack()` is false.

- [ ] **Step 4: Convert all auth tests**

Update sign-in, sign-up, verify-email, forgot-password, verify-reset-code, and reset-password tests to use the helper. Keep API validation/error assertions unchanged. Add one test proving VerifyResetCode is registered and reachable from ForgotPassword.

- [ ] **Step 5: Run focused checks without committing the half-cutover**

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/routes/sign-in.test.tsx __tests__/routes/sign-up.test.tsx __tests__/routes/verify-email.test.tsx __tests__/routes/forgot-password.test.tsx __tests__/routes/verify-reset-code.test.tsx __tests__/routes/reset-password.test.tsx --runInBand
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile exec eslint 'app/(auth)/**/*.tsx' src/components/AuthBackButton.tsx tests/helpers/renderWithNavigation.tsx
```

Expected: the focused checks pass. Do **not** commit yet: the filesystem-router entry would render these converted screens without a React Navigation provider. Continue directly through Task 6 and commit the screen conversion only with the working `AppRegistry` cutover.

### Task 6: Migrate tabs, authenticated routes, and the two broken settings destinations

**Files:**
- Modify/verify: `apps/mobile/index.js`
- Modify/verify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/android/app/build.gradle`
- Modify: `apps/mobile/android/app/src/main/java/com/expyrico/app/MainActivity.kt`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/giveaways.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/deals.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/browse.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/reviews.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Modify: `apps/mobile/app/(app)/product/[id]/review.tsx`
- Modify: `apps/mobile/app/(app)/product/new.tsx`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Modify: `apps/mobile/app/(app)/deal/[id].tsx`
- Modify: `apps/mobile/app/(app)/deal/new.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/[id].tsx`
- Modify: `apps/mobile/app/(app)/giveaway/[id]/manage.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/[id]/rate.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/mine.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/new.tsx`
- Modify: `apps/mobile/app/(app)/household/index.tsx`
- Modify: `apps/mobile/app/(app)/invite.tsx`
- Modify: `apps/mobile/app/(app)/report/index.tsx`
- Modify: `apps/mobile/app/(app)/settings/index.tsx`
- Modify: `apps/mobile/app/(app)/settings/theme.tsx`
- Modify: `apps/mobile/app/(app)/settings/add-passkey.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/UseNextHero.tsx`
- Create: `apps/mobile/app/(app)/settings/notifications.tsx`
- Create: `apps/mobile/app/(app)/settings/account.tsx`
- Create: `apps/mobile/__tests__/routes/app-navigation.test.tsx`
- Modify: `apps/mobile/__tests__/routes/settings-index.test.tsx`
- Modify: `apps/mobile/tests/unit/tab-layout.test.ts`

- [ ] **Step 1: Add failing app navigation tests**

Pass an optional initial app-stack state to `renderAuthenticatedNavigation`, then cover these route outcomes with a real navigator:

```ts
const home = renderAuthenticatedNavigation({ index: 0, routes: [{ name: 'MainTabs' }] });
fireEvent.press(await home.findByLabelText('Scan pantry items'));
await waitFor(() => expect(home.navigationRef.getCurrentRoute()?.name).toBe('Scan'));

const settings = renderAuthenticatedNavigation({ index: 0, routes: [{ name: 'Settings' }] });
fireEvent.press(await settings.findByLabelText('Notifications'));
await waitFor(() =>
  expect(settings.navigationRef.getCurrentRoute()?.name).toBe('NotificationSettings'),
);
```

Add separate Settings-start tests for Account and Add passkey, a Profile-start test for Settings, and assert the tab registry has exactly `Home`, `Giveaways`, `Deals`, `Browse`, `Reviews`, and `Profile`.

- [ ] **Step 2: Verify failure**

Run:

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/routes/app-navigation.test.tsx __tests__/routes/settings-index.test.tsx tests/unit/tab-layout.test.ts --runInBand
```

Expected: FAIL while path-based navigation and missing screens remain.

- [ ] **Step 3: Apply the exact app route conversion map**

```text
/scan -> Scan
/product/:id -> ProductDetail{id}
/product/new?barcode&qr -> ProductNew{barcode,qr}
/product/:id/review -> ProductReview{id}
/record/:id -> RecordDetail{id}
/deal/:id -> DealDetail{id}
/deal/new?editId -> DealEditor{editId}
/giveaway/:id -> GiveawayDetail{id}
/giveaway/:id/manage -> GiveawayManage{id}
/giveaway/:id/rate -> GiveawayRate{id}
/giveaway/mine -> GiveawayMine
/giveaway/new -> GiveawayNew
/(app)/household -> Household
/(app)/invite -> Invite
/report?targetType&targetId -> Report{targetType,targetId}
/(app)/settings -> Settings
/(app)/settings/theme -> ThemeSettings
/(app)/settings/add-passkey -> AddPasskey
/(app)/settings/notifications -> NotificationSettings
/(app)/settings/account -> AccountSettings
/home and /(app)/(tabs)/home -> root App/MainTabs/Home
```

Use `NativeStackScreenProps` for stack screens and `BottomTabScreenProps` for tab screens. Remove every `Stack.Screen` JSX element; static titles belong in `AppNavigator`, while Deal/Giveaway detail screens call `navigation.setOptions({ title })` after data loads.

- [ ] **Step 4: Make DealEditor honor its existing `editId` contract**

When `route.params?.editId` exists, call `useDeal(editId)`. After the response includes its product, render:

```tsx
<DealForm
  product={{ id: existing.product.id, name: existing.product.name }}
  existing={existing}
  onDone={() => navigation.goBack()}
/>
```

Render the shared loading/error state if the deal or embedded product is unavailable. Preserve product search only for create mode. Add a test that edit mode prepopulates the form and calls the update mutation.

- [ ] **Step 5: Implement the missing Settings screens using existing behavior only**

`notifications.tsx` renders a `Screen` containing the title `Notifications`, a semantic status row, and a Sage outlined `Button` labelled `Open system settings` whose handler is exactly `() => void Linking.openSettings()`. At this stage Android status is `Allowed`/`Not allowed` from `PermissionsAndroid.check(POST_NOTIFICATIONS)` on API 33+ and `Allowed by Android version` below API 33; iOS displays `Review in system settings` until the FCM permission adapter replaces it in Task 12. Re-read status in `useFocusEffect` so returning from Settings refreshes the row.

`account.tsx` selects `user?.email` and `signOut` from the session store, renders the email (or `Email unavailable`), and provides exactly two actions:

```tsx
<Button
  label="Add a passkey"
  variant="outline"
  onPress={() => navigation.navigate('AddPasskey')}
/>
<Button
  label="Sign out"
  variant="ghost"
  onPress={async () => {
    try {
      await authEndpoints.logout();
    } finally {
      await signOut();
    }
  }}
/>
```

Use the existing `Screen`, `Button`, text scale, spacing, and theme tokens; do not add an endpoint or a destructive-brand color. Tests assert the notification status variants, `Linking.openSettings`, AddPasskey navigation, API logout attempt, and guaranteed local sign-out after an API rejection.

- [ ] **Step 6: Pass all route tests before switching the shipping entry**

```bash
pnpm --filter @expyrico/mobile exec jest __tests__/routes/app-navigation.test.tsx __tests__/routes/settings-index.test.tsx tests/unit/tab-layout.test.ts __tests__/DealForm.test.tsx --runInBand
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile exec eslint 'app/(app)/**/*.tsx' src/features/records/RecordList.tsx src/features/records/UseNextHero.tsx src/navigation
```

- [ ] **Step 7: Atomically switch the shipping JavaScript entry to React Navigation**

Create `apps/mobile/app.json`:

```json
{
  "name": "Expyrico",
  "displayName": "Expyrico"
}
```

Create `apps/mobile/index.js`:

```js
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

Set `apps/mobile/package.json.main` to `index.js`, set Android `react.entryFile = file("../../index.js")`, and change `MainActivity.getMainComponentName()` to `Expyrico`. Keep the existing host/delegate wrapper only until Task 13; it can host the standard registered component while the remaining native capabilities are migrated.

Run the local debug build with the committed non-secret example config:

```bash
cd apps/mobile
ENVFILE=.env.example \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
cd ../..
```

Expected: the APK compiles with `index.js`; Welcome renders through `RootNavigator`; both auth actions and Home can be reached. The native host still contains the old wrapper at this point, so this is not yet the no-runtime acceptance build.

- [ ] **Step 8: Commit the complete, working navigation cutover**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/index.js apps/mobile/app.json apps/mobile/package.json apps/mobile/android/app/build.gradle apps/mobile/android/app/src/main/java/com/expyrico/app/MainActivity.kt 'apps/mobile/app/(auth)' 'apps/mobile/app/(app)' apps/mobile/src/components/AuthBackButton.tsx apps/mobile/src/features/records apps/mobile/src/navigation apps/mobile/tests/helpers/renderWithNavigation.tsx apps/mobile/__tests__ apps/mobile/tests/unit/tab-layout.test.ts
git commit -m "refactor(mobile): replace filesystem routing"
```

Expected: this commit is independently buildable and launches React Navigation; there is no committed state where converted screens are rendered by the old filesystem router.

### Task 7: Split credentials from non-secret persistent state

**Files:**
- Modify: `apps/mobile/src/auth/secure-store.ts`
- Modify: `apps/mobile/src/auth/session-store.ts`
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/api/client.test.ts`
- Create: `apps/mobile/src/storage/persistent-store.ts`
- Modify: `apps/mobile/src/referral/pendingReferralStore.ts`
- Modify: theme/sync/push callers of generic `getItem` and `setItem`
- Modify: secure store, session, theme, sync, and referral tests
- Create: `apps/mobile/tests/mocks/react-native-keychain.ts`
- Create: `apps/mobile/tests/mocks/async-storage.ts`

- [ ] **Step 1: Rewrite storage tests against the new boundaries**

Tests must assert access/refresh tokens use separate Keychain service names, theme/referral values use Async Storage, `clearCredentials()` leaves unrelated Async Storage keys intact, and invalid theme IDs are rejected.

- [ ] **Step 2: Verify the tests fail with Expo SecureStore**

```bash
pnpm --filter @expyrico/mobile exec jest src/auth/secure-store.test.ts src/auth/session-store.test.ts src/theme/store.test.ts src/theme/sync.test.ts --runInBand
```

Expected: FAIL on missing Keychain/Async Storage mocks or APIs.

- [ ] **Step 3: Implement credential storage**

Use this service mapping in `secure-store.ts`:

```ts
const ACCESS_SERVICE = 'com.expyrico.auth.access';
const REFRESH_SERVICE = 'com.expyrico.auth.refresh';

async function read(service: string): Promise<string | null> {
  const value = await Keychain.getGenericPassword({ service });
  return value ? value.password : null;
}

async function write(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword('token', value, {
    service,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
```

Expose `getAccessToken`, `setAccessToken`, `getRefreshToken`, `setRefreshToken`, and `clearCredentials`. Replace the session store and API refresh-failure calls to `clearAll()` with `clearCredentials()`. Do not store theme or arbitrary keys in Keychain.

- [ ] **Step 4: Implement non-secret persistence**

`persistent-store.ts` wraps `AsyncStorage.getItem`, `setItem`, `removeItem`, and `multiRemove`. Move theme preference, pending referral code, sync cursor, and push flags to this wrapper. Change session sign-out to clear credentials and push registration state without deleting the user’s chosen theme.

- [ ] **Step 5: Pass storage tests and commit**

```bash
pnpm --filter @expyrico/mobile exec jest src/auth src/theme src/referral src/db --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/auth apps/mobile/src/api/client.ts apps/mobile/src/api/client.test.ts apps/mobile/src/storage apps/mobile/src/referral apps/mobile/src/theme apps/mobile/src/db apps/mobile/tests/mocks
git commit -m "refactor(mobile): replace secure store persistence"
```

### Task 8: Replace icons, Apple authentication, status bar, and device/constants APIs

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Modify: `apps/mobile/app/(auth)/verify-email.tsx`
- Modify: `apps/mobile/app/(auth)/verify-reset-code.tsx`
- Modify: `apps/mobile/src/components/AuthHeader.tsx`
- Modify: `apps/mobile/src/components/Button.tsx`
- Modify: `apps/mobile/src/components/EmptyState.tsx`
- Modify: `apps/mobile/src/navigation/FloatingTabBar.tsx`
- Modify: `apps/mobile/src/auth/apple.ts`
- Modify: `apps/mobile/src/features/push/registerPushToken.ts`
- Modify: relevant test setup/mocks

- [ ] **Step 1: Add focused Apple-auth and icon rendering tests**

Mock `@invertase/react-native-apple-authentication` and assert availability is false on Android, cancellation is surfaced, and a valid credential returns the identity token/name. Render `Button`, `AuthHeader`, tab bar, and Profile once to prove Ionicons resolve without the Expo package.

- [ ] **Step 2: Replace imports exactly**

Change:

```ts
import { Ionicons } from '@expo/vector-icons';
```

to:

```ts
import Ionicons from 'react-native-vector-icons/Ionicons';
```

Replace `expo-apple-authentication` with `@invertase/react-native-apple-authentication`, mapping the returned `identityToken`, `fullName.givenName`, and `fullName.familyName` to the existing `AppleSignInResult`. Use React Native `StatusBar`, `Linking`, and `Platform`; omit device model when it is unavailable rather than introducing another dependency.

- [ ] **Step 3: Run tests and commit**

```bash
pnpm --filter @expyrico/mobile exec jest src/auth __tests__/routes/sign-in.test.tsx src/components --runInBand
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile exec eslint app src --ext .ts,.tsx
git add apps/mobile/app apps/mobile/src apps/mobile/tests
git commit -m "refactor(mobile): replace Expo utility modules"
```

### Task 9: Replace barcode and OCR camera flows with Vision Camera

**Files:**
- Modify: `apps/mobile/src/features/scan/ScanCamera.tsx`
- Modify: `apps/mobile/src/features/scan/usePermission.ts`
- Modify: `apps/mobile/src/features/expiry/OcrCamera.tsx`
- Modify: `apps/mobile/src/tests/ScanCamera.test.tsx`
- Create: `apps/mobile/src/features/expiry/OcrCamera.test.tsx`
- Modify: `apps/mobile/android/gradle.properties`

- [ ] **Step 1: Rewrite camera tests against Vision Camera**

Mock `useCameraDevice`, `useCodeScanner`, and the `Camera` component. Capture the scanner callback and assert EAN/UPC map to `{ kind: 'barcode' }`, QR maps to `{ kind: 'qr' }`, duplicate values are ignored for two seconds, and an absent camera renders a friendly unavailable state. OCR tests must assert `takePhoto()` passes `file://${photo.path}` to ML Kit.

- [ ] **Step 2: Verify failure**

```bash
pnpm --filter @expyrico/mobile exec jest src/tests/ScanCamera.test.tsx src/features/expiry/OcrCamera.test.tsx --runInBand
```

Expected: FAIL while the Expo camera mock remains.

- [ ] **Step 3: Implement the scanner**

Use `useCameraDevice('back')` and:

```tsx
const codeScanner = useCodeScanner({
  codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'qr'],
  onCodeScanned: (codes) => {
    const code = codes.find((item) => item.value);
    if (!code?.value || lastValue.current === code.value) return;
    lastValue.current = code.value;
    resetTimer.current = setTimeout(() => (lastValue.current = null), 2000);
    onScan({ kind: code.type === 'qr' ? 'qr' : 'barcode', value: code.value });
  },
});
```

Render `<Camera device={device} isActive codeScanner={codeScanner} style={StyleSheet.absoluteFill} />` and clear the timer on unmount.

- [ ] **Step 4: Implement permissions and OCR photo capture**

Map `Camera.getCameraPermissionStatus()` and `Camera.requestCameraPermission()` to `unknown|granted|denied`. In OCR, use `<Camera photo device={device} isActive ref={cameraRef} />`, call `takePhoto({ enableShutterSound: false })`, and pass `file://${photo.path}` to `TextRecognition.recognize`.

Add to `apps/mobile/android/gradle.properties`:

```properties
VisionCamera_enableCodeScanner=true
VisionCamera_enableFrameProcessors=false
```

- [ ] **Step 5: Pass camera tests and commit**

```bash
pnpm --filter @expyrico/mobile exec jest src/tests/ScanCamera.test.tsx src/features/expiry/OcrCamera.test.tsx --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/features apps/mobile/src/tests apps/mobile/android/gradle.properties
git commit -m "refactor(mobile): migrate camera flows to Vision Camera"
```

### Task 10: Prepare the atomic push cutover — shared contract and database (part 1/3)

**Files:**
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260714_native_fcm_tokens/migration.sql`
- Modify: `api/src/services/push/repository.ts`
- Modify: `api/src/routes/me/push-token.ts`
- Modify: `api/tests/integration/push-routes.test.ts`
- Regenerate: shared build output and Prisma client

- [ ] **Step 1: Rewrite the API contract tests first**

Use payloads such as:

```ts
const payload = {
  deviceToken: 'fcm:android:abcdefghijklmnopqrstuvwxyz0123456789',
  platform: 'android' as const,
  deviceInfo: { os: '36' },
};
```

Assert idempotent upsert, user reassignment on a reused device token, revocation by ID, and rejection of whitespace/short tokens.

- [ ] **Step 2: Verify failure**

```bash
pnpm --filter @expyrico/api test -- tests/integration/push-routes.test.ts
```

Expected: FAIL because the schema still requires `expoPushToken`.

- [ ] **Step 3: Implement the shared schema**

Replace the token schemas with:

```ts
const deviceTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(4096)
  .refine((value) => !/\s/.test(value), 'invalid device token');

export const pushTokenRegisterSchema = z.object({
  deviceToken: deviceTokenSchema,
  platform: z.enum(['ios', 'android']),
  deviceInfo: z.record(z.unknown()).optional(),
});

export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  deviceToken: deviceTokenSchema,
  platform: z.enum(['ios', 'android']),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
```

- [ ] **Step 4: Add a forward-only data migration**

Create `migration.sql`:

```sql
ALTER TABLE "push_tokens" RENAME COLUMN "expoPushToken" TO "deviceToken";
ALTER INDEX "push_tokens_expoPushToken_key" RENAME TO "push_tokens_deviceToken_key";
UPDATE "push_tokens" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;
ALTER TABLE "push_logs" RENAME COLUMN "expo_ticket_id" TO "provider_message_id";
```

Rename Prisma fields to `deviceToken` and `providerMessageId @map("provider_message_id")`. Do not edit the already applied initial migrations.

- [ ] **Step 5: Update repository/route code and regenerate**

Use `deviceToken` consistently in upsert/create/response mapping. Run:

```bash
pnpm --filter @expyrico/shared build
rsync -a packages/shared/dist/ apps/mobile/local-packages/@expyrico/shared/dist/
pnpm --filter @expyrico/api db:generate
pnpm --filter @expyrico/api test -- tests/integration/push-routes.test.ts
```

Expected: shared build, Prisma generation, and route tests pass.

- [ ] **Step 6: Hold the cutover changes for the server adapter**

Do not commit this part alone: the old worker and mobile registrar still reference the old fields. Continue directly to Tasks 11 and 12. The route test is the part-level gate; the complete API/mobile typecheck is required before the atomic commit in Task 12.

### Task 11: Prepare the atomic push cutover — Firebase Admin sender (part 2/3)

**Files:**
- Delete: `api/src/services/push/expo-push.ts`
- Create: `api/src/services/push/fcm-push.ts`
- Modify: `api/src/workers/notification-send.ts`
- Modify: `api/src/services/admin/breakers.ts`
- Modify: `api/src/config.ts`
- Modify: `api/.env.example`
- Modify: `api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `api/tests/unit/workers-notification-send.test.ts`
- Modify: `api/tests/integration/admin/system-analytics-settings.test.ts`
- Create: `api/tests/unit/fcm-push.test.ts`

- [ ] **Step 1: Write failing FCM sender and worker tests**

Mock `firebase-admin/app` and `firebase-admin/messaging`. Assert a normal send contains all active tokens plus `{ title: 'Expyrico', body, data }`; 501 tokens are split into 500/1 provider calls and results remain in token order; invalid/unregistered error codes revoke the matching token. Assert a rejected provider/circuit call is logged for all affected tokens and rethrown for BullMQ retry, while resolved per-token provider failures are logged without resending successful tokens.

- [ ] **Step 2: Verify failure**

```bash
pnpm --filter @expyrico/api test -- tests/unit/fcm-push.test.ts tests/unit/workers-notification-send.test.ts
```

Expected: FAIL because `fcm-push.ts` is absent.

- [ ] **Step 3: Add validated server configuration**

Add this field to `envSchema`:

```ts
FIREBASE_PROJECT_ID: z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
),
```

After parsing, throw a Zod custom issue when `NODE_ENV === 'production'` and the project ID is absent. Extend `Config` with `push: { firebaseProjectId?: string }` and map the parsed value without a non-null assertion. Add config tests for test-without-ID, production-without-ID failure, and production-with-ID success. Document in `api/.env.example`:

```dotenv
FIREBASE_PROJECT_ID=
# Absolute path outside this repository; consumed by Firebase applicationDefault().
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/repository/firebase-admin.json
```

Do not parse or read the credential JSON in application code; Firebase Admin owns that standard environment variable, and the file must remain outside the repository.

- [ ] **Step 4: Implement the FCM adapter**

`fcm-push.ts` initializes one Firebase app with `applicationDefault()` and the configured project ID. Expose:

```ts
export interface PushResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function sendPush(input: {
  deviceTokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<PushResult[]>;
```

Implement the adapter around one lazily initialized app:

```ts
import CircuitBreaker from 'opossum';
import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getConfig } from '../../config.js';

export interface PushResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface PushInput {
  deviceTokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

let app: App | undefined;

function firebaseApp(): App {
  if (app) return app;
  const projectId = getConfig().push.firebaseProjectId;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required for push delivery');
  app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
  return app;
}

async function sendBatch(input: PushInput): Promise<PushResult[]> {
  const batch = await getMessaging(firebaseApp()).sendEachForMulticast({
    tokens: input.deviceTokens,
    notification: { title: input.title, body: input.body },
    data: input.data,
  });
  return batch.responses.map((response) =>
    response.success
      ? { ok: true, messageId: response.messageId }
      : {
          ok: false,
          errorCode: response.error?.code,
          errorMessage: response.error?.message ?? 'FCM send failed',
        },
  );
}

export const fcmPushBreaker = new CircuitBreaker(sendBatch, {
  name: 'fcm-push',
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

export async function sendPush(input: PushInput): Promise<PushResult[]> {
  if (input.deviceTokens.length === 0) return [];
  const results: PushResult[] = [];
  for (let start = 0; start < input.deviceTokens.length; start += 500) {
    const deviceTokens = input.deviceTokens.slice(start, start + 500);
    results.push(
      ...(await (fcmPushBreaker.fire({ ...input, deviceTokens }) as Promise<PushResult[]>)),
    );
  }
  return results;
}
```

- [ ] **Step 5: Update worker persistence and invalid-token handling**

The worker sends the adapter payload, writes `providerMessageId`, writes a log row for every token, and revokes tokens whose code is `messaging/registration-token-not-registered` or `messaging/invalid-registration-token`. Pair `results[index]` only with `tokens[index]`; assert equal lengths before persistence. For each invalid result, call `revokePushToken(data.userId, token.id)`. A thrown transport/circuit error writes one failure row per token and is rethrown so BullMQ retains the current retry behavior. Preserve the current expiry body text and `{ recordId, type: 'expiry' }` data payload.

- [ ] **Step 6: Pass server checks without committing the half-cutover**

```bash
pnpm --filter @expyrico/api remove expo-server-sdk
pnpm --filter @expyrico/api typecheck
pnpm --filter @expyrico/api test -- tests/unit/fcm-push.test.ts tests/unit/workers-notification-send.test.ts tests/integration/push-routes.test.ts tests/integration/admin/system-analytics-settings.test.ts
```

Expected: the API is internally coherent on the native token contract. Do not commit until the mobile registrar is converted in Task 12, because the copied mobile shared types intentionally enforce the new payload.

### Task 12: Complete and commit the atomic push cutover — native FCM client (part 3/3)

**Files:**
- Modify: `apps/mobile/src/api/push.ts`
- Modify: `apps/mobile/src/features/push/registerPushToken.ts`
- Create: `apps/mobile/src/features/push/pushLifecycle.ts`
- Create: `apps/mobile/src/features/push/pushLifecycle.test.ts`
- Modify: `apps/mobile/src/auth/session-store.ts`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/index.js`
- Modify: `apps/mobile/app/(app)/settings/notifications.tsx`
- Modify: `apps/mobile/tests/setup.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Mock modular Firebase Messaging functions. Assert Android 13 permission denial performs no API request, grant registers `{ deviceToken, platform }`, token refresh re-registers, repeated identical tokens are skipped, and sign-out best-effort deletes the stored registration ID before credentials are cleared. Also assert a credential-free build with `getApps()` returning an empty array disables push cleanly instead of crashing app bootstrap.

- [ ] **Step 2: Verify failure**

```bash
pnpm --filter @expyrico/mobile exec jest src/features/push/pushLifecycle.test.ts src/auth/session-store.test.ts --runInBand
```

Expected: FAIL because the native lifecycle module is absent.

- [ ] **Step 3: Implement registration**

Use modular APIs `getApps`, `getMessaging`, `getToken`, `onTokenRefresh`, `requestPermission`, and `onMessage`. Return a no-op lifecycle when there is no initialized Firebase app; this keeps credential-free local APKs usable while clearly reporting push as unavailable in Notification settings. On Android API 33+, request `PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS`; on iOS, accept authorized or provisional status. Register:

```ts
await registerPushTokenApi({
  deviceToken,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  deviceInfo: { os: String(Platform.Version) },
});
```

Persist the returned registration ID and last token in Async Storage. Expose `startPushLifecycle(): () => void`, `unregisterCurrentDevice(): Promise<void>`, and `getPushPermissionState(): Promise<'allowed' | 'denied' | 'unavailable'>`. The Notification settings screen maps those states to `Allowed`, `Not allowed`, and `Push not configured`; it keeps `Linking.openSettings()` as the only action. `onMessage` preserves the current foreground-receipt behavior without adding a local-notification dependency; a system notification tap must at least relaunch/resume the app, but record-detail routing is outside this runtime migration.

- [ ] **Step 4: Wire lifecycle to authentication**

In `AppBootstrap`, start the lifecycle only when `accessToken` exists and stop listeners on sign-out/unmount. In `session-store.signOut`, call `unregisterCurrentDevice()` best-effort before clearing credentials; ensure API failure cannot prevent local sign-out.

- [ ] **Step 5: Register the background handler at the application entry**

Before `AppRegistry.registerComponent`, add:

```js
import { getApps } from '@react-native-firebase/app';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

const firebaseApps = getApps();
if (firebaseApps.length > 0) {
  setBackgroundMessageHandler(
    getMessaging(firebaseApps[0]),
    async () => undefined,
  );
}
```

This remains a no-op in credential-free builds and is registered before React mounts when Firebase is configured.

- [ ] **Step 6: Pass every affected gate and commit the cutover atomically**

```bash
pnpm --filter @expyrico/mobile exec jest src/features/push src/auth/session-store.test.ts --runInBand
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/shared build
pnpm --filter @expyrico/api typecheck
pnpm --filter @expyrico/api test -- tests/unit/fcm-push.test.ts tests/unit/workers-notification-send.test.ts tests/integration/push-routes.test.ts tests/integration/admin/system-analytics-settings.test.ts
git add packages/shared apps/mobile/local-packages/@expyrico/shared api/prisma api/src api/tests api/package.json apps/mobile/index.js apps/mobile/src/features/push apps/mobile/src/api/push.ts apps/mobile/src/auth/session-store.ts apps/mobile/src/App.tsx 'apps/mobile/app/(app)/settings/notifications.tsx' apps/mobile/tests/setup.ts pnpm-lock.yaml
git commit -m "refactor(push): cut over to native FCM delivery"
```

Expected: shared, API, and mobile agree on `deviceToken`; the server sends FCM; the client registers FCM; no commit in branch history contains only half of the contract migration.

### Task 13: Switch Android and JavaScript tooling to the standard React Native host

**Files:**
- Create: `apps/mobile/index.js`
- Create: `apps/mobile/app.json`
- Modify: `apps/mobile/android/settings.gradle`
- Modify: `apps/mobile/android/build.gradle`
- Modify: `apps/mobile/android/app/build.gradle`
- Modify: `apps/mobile/android/app/src/main/java/com/expyrico/app/MainApplication.kt`
- Modify: `apps/mobile/android/app/src/main/java/com/expyrico/app/MainActivity.kt`
- Modify: Android manifest/styles/splash resources
- Modify: `apps/mobile/babel.config.js`
- Modify: `apps/mobile/metro.config.js`
- Modify: `apps/mobile/jest.config.js`
- Modify: `apps/mobile/react-native.config.js`
- Modify: `apps/mobile/tsconfig.json`
- Modify: `apps/mobile/.eslintrc.cjs`
- Modify: `apps/mobile/.gitignore`
- Modify: `.prettierignore`
- Modify: root `tsconfig.json`
- Delete: `test-metro-config.js`
- Delete: `apps/mobile/app.config.ts`
- Delete: `apps/mobile/eas.json`
- Delete: four Expo Router layout files
- Delete: `apps/mobile/tests/mocks/expo-*.ts`
- Delete: `apps/mobile/__tests__/root-layout-splash.test.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Verify the standard entrypoint before removing its former host**

`app.json` must still register `Expyrico`. `index.js` must import gesture-handler first, register `src/App` through `AppRegistry`, and contain the credential-safe Firebase background handler added in Task 12. Run:

```bash
rg -n "AppRegistry.registerComponent|setBackgroundMessageHandler|from './src/App'" apps/mobile/index.js
node -e "const app=require('./apps/mobile/app.json'); if(app.name!=='Expyrico') process.exit(1)"
```

Expected: all three entrypoint responsibilities are present before native wrappers are deleted.

- [ ] **Step 2: Replace Android Expo wrappers**

`MainActivity.getMainComponentName()` returns `Expyrico` and returns `DefaultReactActivityDelegate` directly. Its complete class body is:

Use the standard delegate body:

```kotlin
override fun getMainComponentName(): String = "Expyrico"

override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(
        this,
        mainComponentName,
        DefaultNewArchitectureEntryPoint.fabricEnabled
    )
```

Replace `MainApplication.kt` with the standard host shape below, retaining its package declaration and standard imports for `PackageList`, `ReactApplication`, `ReactHost`, `ReactNativeHost`, `ReactPackage`, `DefaultReactNativeHost`, `getDefaultReactHost`, `SoLoader`, and `OpenSourceMergedSoMapping`:

```kotlin
class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> = PackageList(this).packages
            override fun getJSMainModuleName(): String = "index"
            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) load()
    }
}
```

Remove the obsolete `Configuration` import/override and every old lifecycle/host wrapper import.

- [ ] **Step 3: Replace Gradle hooks**

Remove the two old module-autolinking lines from settings and retain the monorepo-aware standard configuration:

```gradle
pluginManagement {
    includeBuild("../../../node_modules/@react-native/gradle-plugin")
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
plugins { id("com.facebook.react.settings") }
includeBuild("../../../node_modules/@react-native/gradle-plugin")
extensions.configure(com.facebook.react.ReactSettingsExtension) { extension ->
    extension.autolinkLibrariesFromCommand(
        ["node", new File(rootDir, "../../../node_modules/react-native/cli.js").absolutePath, "config"],
        file(".."),
        files("../package.json", "../react-native.config.js", "../../../pnpm-lock.yaml")
    )
}
rootProject.name = "Expyrico"
include(":app")
```

Keep the existing `dependencyResolutionManagement` repositories below that block. Point `entryFile` to `../../index.js`. Apply React Native Config and vector-icon fonts. Add `classpath("com.google.gms:google-services:4.4.4")` and apply the plugin only when untracked `apps/mobile/android/app/google-services.json` exists; warn otherwise so credential-free emulator builds still compile and launch with push disabled. Preserve application ID, SDK versions, Hermes, new architecture, Kotlin version, portrait mode, and URL scheme. Confirm the manifest retains camera/network permissions, adds Android 13 `POST_NOTIFICATIONS`, and keeps the `expyrico` deep-link intent filter.

Keep production cleartext disabled while allowing the isolated emulator job to opt in explicitly. Set `<application android:usesCleartextTraffic="${usesCleartextTraffic}">` and add:

```gradle
defaultConfig {
    manifestPlaceholders = [usesCleartextTraffic: "false"]
}
buildTypes {
    debug {
        manifestPlaceholders.usesCleartextTraffic = "true"
    }
    release {
        manifestPlaceholders.usesCleartextTraffic =
            project.findProperty("allowCleartext") == "true" ? "true" : "false"
    }
}
```

Only CI’s ephemeral release build may pass `-PallowCleartext=true`; normal `assembleRelease` must merge `usesCleartextTraffic="false"`.

The relevant `app/build.gradle` configuration is:

```gradle
react {
    root = file("../..")
    reactNativeDir = file("../../../../node_modules/react-native")
    codegenDir = file("../../../../node_modules/@react-native/codegen")
    cliFile = file("../../../../node_modules/react-native/cli.js")
    entryFile = file("../../index.js")
    hermesCommand = file("../../../../node_modules/react-native/sdks/hermesc/osx-bin/hermesc").absolutePath
    autolinkLibrariesWithApp()
}

apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")

if (file("google-services.json").exists()) {
    apply plugin: "com.google.gms.google-services"
} else {
    logger.warn("Firebase client configuration absent; push registration is disabled")
}
```

- [ ] **Step 4: Replace Babel, Metro, Jest, and TypeScript bases**

Use `module:@react-native/babel-preset`, `@react-native/metro-config`, and Jest `preset: 'react-native'`. Retain NativeWind, decorators, Reanimated, monorepo watch folders, and the existing React resolver workaround. Remove Expo mappers/include paths. Root `tsconfig.json` extends `./tsconfig.base.json`; mobile TS includes `index.js`, `app.json`, `app/**/*`, `src/**/*`, and `tests/**/*` only. Remove `.expo` and `expo-env.d.ts` entries/comments from mobile ESLint/Git ignore files and `.prettierignore`.

Use this Babel shape:

```js
module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);
  return {
    presets: [
      ['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
```

Metro starts with `getDefaultConfig(projectRoot)` from `@react-native/metro-config`, retains the current workspace watch folders/React resolver, and is passed to `withNativeWind(config, { input: './global.css' })`. Jest keeps the existing React and `@/` mappers, replaces its preset with `react-native`, removes all Expo mappers, and retains only React Native/Navigation/NativeWind packages in `transformIgnorePatterns`.

- [ ] **Step 5: Remove the obsolete mobile runtime and generated configuration**

Run:

```bash
pnpm --filter @expyrico/mobile remove expo @expo/vector-icons expo-apple-authentication expo-asset expo-blur expo-build-properties expo-camera expo-constants expo-dev-client expo-device expo-linking expo-notifications expo-router expo-secure-store expo-splash-screen expo-status-bar expo-updates
pnpm --filter @expyrico/mobile remove -D babel-preset-expo jest-expo
git rm apps/mobile/app.config.ts apps/mobile/eas.json 'apps/mobile/app/_layout.tsx' 'apps/mobile/app/(auth)/_layout.tsx' 'apps/mobile/app/(app)/_layout.tsx' 'apps/mobile/app/(app)/(tabs)/_layout.tsx'
git rm apps/mobile/tests/mocks/expo-constants.ts apps/mobile/tests/mocks/expo-router.ts apps/mobile/tests/mocks/expo-secure-store.ts apps/mobile/tests/mocks/expo-splash-screen.ts
git rm apps/mobile/__tests__/root-layout-splash.test.tsx
pnpm install
```

Remove the matching setup mocks/comments. Keep `main: "index.js"`, remove the web script, and set the native scripts to local tools with an overridable config file:

```json
{
  "scripts": {
    "start": "react-native start",
    "android:build": "ENVFILE=${ENVFILE:-.env.example} JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\" ANDROID_HOME=\"$HOME/Library/Android/sdk\" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug",
    "android:release": "ENVFILE=${ENVFILE:-.env.example} JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\" ANDROID_HOME=\"$HOME/Library/Android/sdk\" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleRelease",
    "android:install": "ENVFILE=${ENVFILE:-.env.example} JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\" ANDROID_HOME=\"$HOME/Library/Android/sdk\" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:installDebug",
    "ios": "ENVFILE=${ENVFILE:-.env.example} react-native run-ios",
    "ios:build": "ENVFILE=${ENVFILE:-.env.example} xcodebuild -workspace ios/Expyrico.xcworkspace -scheme Expyrico -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build",
    "clean": "rm -rf android/app/build android/.gradle ios/build"
  }
}
```

Retain the existing test/typecheck/lint scripts unchanged. These commands never invoke a cloud build or development launcher.

- [ ] **Step 6: Verify native splash theme parity**

Keep current light resources. Make `drawable-night/splash_screen.xml`, `values-night/styles.xml`, and `values-night-v31/styles.xml` use the dark logo/background and light status/navigation icons. The JS bootstrap overlay must use the resolved theme so there is no white flash after the native launch screen.

- [ ] **Step 7: Compile the debug APK with Gradle and no development launcher**

```bash
cd apps/mobile
ENVFILE=.env.example \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
```

Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists and Gradle output contains no Expo module tasks. This compile check does not claim standalone runtime behavior; the release APK in Task 16 contains the JavaScript bundle and runs without Metro.

- [ ] **Step 8: Run tests and commit**

```bash
cd ../..
pnpm --filter @expyrico/mobile test -- --runInBand
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/index.js apps/mobile/app.json apps/mobile/android apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/jest.config.js apps/mobile/react-native.config.js apps/mobile/tsconfig.json apps/mobile/.eslintrc.cjs apps/mobile/.gitignore apps/mobile/package.json apps/mobile/tests apps/mobile/app .prettierignore pnpm-lock.yaml tsconfig.json
git rm test-metro-config.js
git commit -m "refactor(mobile): switch to bare Android host"
```

### Task 14: Create and verify the missing bare iOS host

**Files:**
- Modify: `.gitignore`
- Create: `apps/mobile/Gemfile`
- Create: `apps/mobile/Gemfile.lock`
- Create: `apps/mobile/ios/Podfile`
- Create: `apps/mobile/ios/Config.xcconfig`
- Create: `apps/mobile/ios/Config.Debug.xcconfig`
- Create: `apps/mobile/ios/Config.Release.xcconfig`
- Create: standard generated `apps/mobile/ios/Expyrico.xcodeproj/**`
- Create: `apps/mobile/ios/Expyrico/AppDelegate.h`
- Create: `apps/mobile/ios/Expyrico/AppDelegate.mm`
- Create: `apps/mobile/ios/Expyrico/Info.plist`
- Create: `apps/mobile/ios/Expyrico/LaunchScreen.storyboard`
- Create: `apps/mobile/ios/Expyrico/PrivacyInfo.xcprivacy`
- Create: `apps/mobile/ios/Expyrico/Expyrico.entitlements`
- Create: `apps/mobile/ios/Expyrico/Images.xcassets/**`
- Create: `apps/mobile/ios/.xcode.env`

- [ ] **Step 1: Stop ignoring the native project and ignore only credentials/build output**

Remove the obsolete root `.expo/` entry and replace the broad `apps/mobile/ios/` ignore with:

```gitignore
apps/mobile/ios/Pods/
apps/mobile/ios/build/
apps/mobile/.bundle/
apps/mobile/vendor/bundle/
apps/mobile/ios/tmp.xcconfig
apps/mobile/ios/GoogleService-Info.plist
apps/mobile/android/app/google-services.json
```

- [ ] **Step 2: Generate an exact React Native 0.76.9 reference host**

Run from the migration worktree; the reference directory is temporary and only the generated iOS host is copied:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
REFERENCE_ROOT="$(mktemp -d)"
trap 'rm -rf "$REFERENCE_ROOT"' EXIT
cd "$REFERENCE_ROOT"
pnpm dlx @react-native-community/cli@15.0.0 init Expyrico --version 0.76.9 --skip-install
mkdir -p "$REPO_ROOT/apps/mobile/ios"
rsync -a "$REFERENCE_ROOT/Expyrico/ios/" "$REPO_ROOT/apps/mobile/ios/"
cd "$REPO_ROOT"
```

The generated target and scheme are already `Expyrico`; change only the bundle identifier to `com.expyrico.app`. The shell trap deletes the temporary reference directory; do not add it to Git. Treat generated Xcode project files as a mechanical scaffold; all project-specific changes below are reviewed explicitly.

- [ ] **Step 3: Configure environment-backed build settings exactly**

Create `Config.xcconfig`:

```xcconfig
#include? "tmp.xcconfig"
```

Create `Config.Debug.xcconfig` and `Config.Release.xcconfig` respectively:

```xcconfig
#include? "Pods/Target Support Files/Pods-Expyrico/Pods-Expyrico.debug.xcconfig"
#include "Config.xcconfig"
APS_ENVIRONMENT = development
```

```xcconfig
#include? "Pods/Target Support Files/Pods-Expyrico/Pods-Expyrico.release.xcconfig"
#include "Config.xcconfig"
APS_ENVIRONMENT = production
```

Assign these as the app target’s Debug and Release base configurations. Add a shared-scheme Build pre-action, with build settings supplied by the `Expyrico` target:

```bash
export ENVFILE="${ENVFILE:-.env.example}"
"${SRCROOT}/../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" \
  "${SRCROOT}/.." \
  "${SRCROOT}/tmp.xcconfig"
```

This makes `ENVFILE=.env.example xcodebuild ...` generate `tmp.xcconfig`; real identity builds use the ignored `.env.mobile.local`. `Info.plist` registers separate `expyrico` and `$(GOOGLE_IOS_URL_SCHEME)` URL-scheme entries. Never commit a placeholder production client ID.

Set `CODE_SIGN_ENTITLEMENTS = Expyrico/Expyrico.entitlements` on the app target in both Debug and Release. This assignment is required in addition to creating the file; otherwise Apple Sign In, APNs, and Associated Domains are not embedded in signed products.

- [ ] **Step 4: Configure identity, push, launch, and privacy capabilities**

Set the bundle identifier to `com.expyrico.app`, display/version values to the Android equivalents, iPhone portrait orientations, `UIUserInterfaceStyle=Automatic`, camera usage text, and `UIBackgroundModes = [remote-notification]`. Add `UIAppFonts = [Ionicons.ttf]` to `Info.plist`, add `node_modules/react-native-vector-icons/Fonts/Ionicons.ttf` to the app target's Copy Bundle Resources phase, and do not bundle unused icon fonts. In `Expyrico.entitlements`, add:

```xml
<key>aps-environment</key>
<string>$(APS_ENVIRONMENT)</string>
<key>com.apple.developer.applesignin</key>
<array><string>Default</string></array>
<key>com.apple.developer.associated-domains</key>
<array><string>$(PASSKEY_ASSOCIATED_DOMAIN)</string></array>
```

The real passkey environment must set `PASSKEY_ASSOCIATED_DOMAIN=webcredentials:<rp-domain>`. Before signed-device verification, confirm `https://<rp-domain>/.well-known/apple-app-site-association` returns, without redirect, JSON containing:

```json
{
  "webcredentials": {
    "apps": ["<APPLE_TEAM_ID>.com.expyrico.app"]
  }
}
```

Populate `Images.xcassets/AppIcon.appiconset` from `apps/mobile/assets/icon.png` and its dark appearance from `icon-dark.png`; populate a launch image set from `splash.png`/`splash-dark.png`. `LaunchScreen.storyboard` centers that launch image on a named semantic color whose Any value is Warm White `#FAFAF8` and Dark value matches the approved dark theme background. Do not redraw, recolor, or substitute the approved assets. Preserve the generated privacy manifest and add only API-reason entries actually reported by the linked-library build audit.

In `AppDelegate.mm`, retain the generated RN 0.76 `RCTAppDelegate` structure, set `moduleName = @"Expyrico"`, return `index` from the bundle URL method, and initialize Firebase only when the untracked plist exists:

```objc
#import <FirebaseCore/FirebaseCore.h>

NSString *firebasePath = [[NSBundle mainBundle] pathForResource:@"GoogleService-Info"
                                                         ofType:@"plist"];
if (firebasePath != nil && [FIRApp defaultApp] == nil) {
  [FIRApp configure];
}
```

Add a final target Run Script phase named `[Expyrico] Copy optional Firebase config`, after Copy Bundle Resources. Keep the untracked plist outside the project file so credential-free builds remain valid; the script is the only mechanism that conditionally embeds it:

```bash
set -euo pipefail
SOURCE="${PROJECT_DIR}/GoogleService-Info.plist"
DESTINATION="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"
if [ -f "$SOURCE" ]; then
  /bin/mkdir -p "$(/usr/bin/dirname "$DESTINATION")"
  /usr/bin/ditto "$SOURCE" "$DESTINATION"
else
  /bin/rm -f "$DESTINATION"
fi
```

Set `ENABLE_USER_SCRIPT_SANDBOXING = NO` for this React Native app target because the optional source cannot be declared as a mandatory Xcode input path. The source remains ignored and absent in credential-free CI; a credentialed build must prove the plist is present in the final `.app` bundle.

- [ ] **Step 5: Pin CocoaPods and configure native modules**

Create `apps/mobile/Gemfile`:

```ruby
source 'https://rubygems.org'
gem 'cocoapods', '1.16.2'
```

Use the generated RN 0.76 Podfile with `use_react_native!`, Hermes, new architecture settings, `use_native_modules!`, and one standard `react_native_post_install` block. Do not hard-code an env file in the Pod project; every documented `pod`, `xcodebuild`, and `react-native run-ios` command supplies `ENVFILE`, which is the selection mechanism supported by React Native Config. Install a Bundler version compatible with the Mac’s system Ruby, install the locked pods, and compile:

```bash
gem install --user-install bundler -v 2.4.22
export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"
cd apps/mobile
bundle _2.4.22_ config set --local path vendor/bundle
bundle _2.4.22_ install
cd ios
ENVFILE=.env.example bundle _2.4.22_ exec pod install --repo-update
ENVFILE=.env.example xcodebuild -workspace Expyrico.xcworkspace -scheme Expyrico -configuration Debug -sdk iphonesimulator -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
APP=build/DerivedData/Build/Products/Debug-iphonesimulator/Expyrico.app
test -f "$APP/Ionicons.ttf"
test ! -f "$APP/GoogleService-Info.plist"
plutil -extract UIAppFonts json -o - "$APP/Info.plist" | rg 'Ionicons\.ttf'
xcodebuild -workspace Expyrico.xcworkspace -scheme Expyrico -configuration Debug -showBuildSettings \
  | rg 'CODE_SIGN_ENTITLEMENTS = Expyrico/Expyrico\.entitlements'
```

Expected: pods install, the simulator build succeeds without any Expo pod or script phase, the built app contains the Ionicons font named by its plist, the credential-free app does not accidentally embed Firebase configuration, and the target points at the checked-in entitlements file.

- [ ] **Step 6: Commit**

```bash
cd ../../..
git add .gitignore apps/mobile/Gemfile apps/mobile/Gemfile.lock apps/mobile/ios
git commit -m "feat(mobile): add bare iOS host"
```

### Task 15: Update all active docs and add a no-Expo regression guard

**Files:**
- Create: `scripts/verify-no-expo-runtime.mjs`
- Modify: root `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/mobile/tests/e2e/sign-up-and-sign-in.yaml`
- Modify: `docs/runbooks/release-checklist.md`
- Modify: active docs listed below
- Modify: dated plans/spec with a superseded banner where actionable

- [ ] **Step 1: Add the runtime guard**

Create `scripts/verify-no-expo-runtime.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageFiles = [
  'package.json',
  'api/package.json',
  'apps/admin/package.json',
  'apps/mobile/package.json',
  'apps/mobile/local-packages/@expyrico/shared/package.json',
  'apps/mobile/local-packages/@expyrico/theme/package.json',
  'apps/mobile/stubs/react-native-worklets/package.json',
  'packages/shared/package.json',
  'packages/theme/package.json',
];
const packagePattern = /^(?:expo(?:-|$)|@expo\/|babel-preset-expo$|jest-expo$|expo-server-sdk$)/;
const sourcePatterns = [
  /(?:from\s*|require\(\s*|import\s*(?:\(\s*)?)['"](?:expo(?:[-/][^'"]*)?|@expo\/[^'"]+)['"]/,
  /expo\.modules|useExpoModules|expo-router\/entry|expo-server-sdk/,
  /\bexpoPushToken\b|\bexpoTicketId\b/,
  /\beas\s+(?:build|submit|update)\b/i,
  /\b(?:Expo Go|Expo CLI|Expo Router|Expo Push|EAS Build|EAS Submit|EAS Update)\b/i,
  /\.expo\/|expo-env\.d\.ts/,
];
const scanRoots = [
  'apps/mobile',
  'api/src',
  'api/package.json',
  'api/prisma/schema.prisma',
  'packages/shared/src',
  '.github/workflows',
  'README.md',
  '.gitignore',
  '.prettierignore',
  'apps/mobile/.gitignore',
  'apps/mobile/docs',
  'docs/code-standards.md',
  'docs/codebase-summary.md',
  'docs/deployment-guide.md',
  'docs/legal/privacy-policy.md',
  'docs/project-overview-pdr.md',
  'docs/project-roadmap.md',
  'docs/runbooks',
  'docs/system-architecture.md',
];
const skipped = new Set([
  'node_modules',
  'build',
  '.gradle',
  'Pods',
  '.cxx',
  '.bundle',
  'vendor',
  'DerivedData',
]);
const findings = [];

for (const relative of packageFiles) {
  const json = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(json[section] ?? {})) {
      if (packagePattern.test(name)) findings.push(`${relative}: ${section}.${name}`);
    }
  }
}

function visit(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolute)) {
      if (!skipped.has(entry)) visit(path.join(relative, entry));
    }
    return;
  }
  const basename = path.basename(relative);
  if (!/\.(?:[cm]?[jt]sx?|m|mm|h|swift|rb|json|gradle|kt|java|md|ya?ml|xml|plist|storyboard|xcconfig|pbxproj|xcscheme|podspec|properties)$/.test(relative)
      && basename !== 'Podfile'
      && basename !== 'Podfile.lock'
      && basename !== 'Gemfile'
      && basename !== 'Gemfile.lock'
      && basename !== '.xcode.env'
      && basename !== '.gitignore'
      && basename !== '.prettierignore') return;
  fs.readFileSync(absolute, 'utf8').split('\n').forEach((line, index) => {
    if (sourcePatterns.some((pattern) => pattern.test(line))) {
      findings.push(`${relative}:${index + 1}: ${line.trim()}`);
    }
  });
}

scanRoots.forEach(visit);
if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('No active Expo runtime, package, build hook, or operational command found.');
```

This intentionally excludes policy text, this migration spec/plan, immutable Prisma migrations, and historical dated plans by not including them in `scanRoots`. It exits non-zero with every offending path/line.

Add root script:

```json
"verify:no-expo-runtime": "node scripts/verify-no-expo-runtime.mjs"
```

In the existing required `.github/workflows/ci.yml` `mobile` job (which runs on pushes and pull requests), add this step immediately after `pnpm install --frozen-lockfile`:

```yaml
      - name: Reject Expo runtime regressions
        run: pnpm verify:no-expo-runtime
```

Do not rely on the scheduled emulator job for this guard; the required mobile job must fail before a prohibited package, import, native hook, or active instruction can merge.

Run it now. Expected: any remaining active dependency/config/import is reported with its exact line. Remove those findings before documentation work; source/runtime findings should already be empty after Tasks 11 and 13.

- [ ] **Step 2: Rewrite current operational documentation**

Update these files to describe React Navigation, native FCM, Keychain/Async Storage, Vision Camera, local Gradle APK builds, ADB install/testing, CocoaPods/Xcode, and external credential provisioning:

```text
README.md
AGENTS.md
apps/mobile/docs/android-submission.md
apps/mobile/docs/assets-checklist.md
apps/mobile/docs/build-and-release.md
apps/mobile/docs/ios-submission.md
docs/code-standards.md
docs/codebase-summary.md
docs/deployment-guide.md
docs/legal/privacy-policy.md
docs/project-overview-pdr.md
docs/project-roadmap.md
docs/runbooks/rotate-secrets.md
docs/runbooks/release-checklist.md
docs/runbooks/security-review.md
docs/runbooks/soft-launch.md
docs/system-architecture.md
```

Apply this file-specific replacement matrix; do not leave dual instructions:

| Files | Required final content |
| --- | --- |
| `README.md`, `docs/project-overview-pdr.md`, `docs/codebase-summary.md` | Identify the client as bare React Native 0.76.9 with `index.js`/React Navigation; quickstart links to the local build doc only |
| `AGENTS.md`, `docs/code-standards.md` | Keep the explicit prohibition and require Gradle/ADB plus typed route names; no old command examples |
| `apps/mobile/docs/build-and-release.md`, `android-submission.md` | Use `ENVFILE`, local Gradle `assembleDebug`/`assembleRelease`, `adb install -r`, signing handoff, APK/Dex guard, and no cloud/OTA path |
| `apps/mobile/docs/ios-submission.md` | Use Bundler 2.4.22, CocoaPods 1.16.2, Xcode workspace/archive, external Firebase/Google values, Associated Domains, and AASA verification |
| `apps/mobile/docs/assets-checklist.md` | Map the checked-in light/dark PNGs to Android resources and iOS asset catalogs |
| `docs/system-architecture.md` | Replace filesystem routing and old push provider diagrams with AppRegistry → React Navigation and mobile FCM → API → Firebase Admin |
| `docs/deployment-guide.md`, `docs/runbooks/release-checklist.md`, `docs/runbooks/soft-launch.md` | Release immutable signed native artifacts; include local APK install and device evidence; remove OTA terminology |
| `docs/legal/privacy-policy.md` | Name Firebase Cloud Messaging for device-token delivery and preserve the existing retention/deletion promises |
| `docs/runbooks/rotate-secrets.md`, `docs/runbooks/security-review.md` | Keep Firebase Admin JSON outside Git, rotate ADC/service accounts, audit platform config/signing files, and run the no-runtime guard |
| `docs/project-roadmap.md` | Mark the bare-runtime migration as the current baseline; historical milestone text remains historical |

Each active command block must be copy/paste runnable from the repository root or state its required working directory. The historical banner text is exactly: `> Superseded for current mobile setup by docs/superpowers/specs/2026-07-14-mobile-bare-react-native-migration-design.md. Do not execute the mobile build/runtime commands below.`

Add a concise “Superseded by the bare React Native migration” banner to these historical documents because they otherwise contain executable mobile setup commands:

```text
docs/superpowers/plans/2026-05-23-m0a-foundation.md
docs/superpowers/plans/2026-05-23-m0b-api-auth-routes.md
docs/superpowers/plans/2026-05-24-m0c-mobile-shell.md
docs/superpowers/plans/2026-05-24-m1-personal-pantry.md
docs/superpowers/plans/2026-05-24-m2-reviews-and-voting.md
docs/superpowers/plans/2026-05-24-m3-admin-dashboard.md
docs/superpowers/plans/2026-05-24-m4-polish-and-launch.md
docs/superpowers/plans/2026-05-26-build-order-backend-first.md
docs/superpowers/plans/2026-05-26-m5-deal-sharing.md
docs/superpowers/plans/2026-05-26-m6-blessing-giveaway.md
docs/superpowers/plans/2026-05-26-m7-referral-and-app-sharing.md
docs/superpowers/plans/2026-05-26-m8-household-sharing.md
docs/superpowers/plans/2026-07-14-mobile-expyrico-consistency.md
docs/superpowers/specs/2026-05-23-expyrico-app-design.md
```

Do not rewrite already-applied Prisma migration history.

- [ ] **Step 3: Make the existing Maestro flow deterministic**

Replace `apps/mobile/tests/e2e/sign-up-and-sign-in.yaml` with one two-phase flow driven by the same injected email:

```yaml
appId: com.expyrico.app
---
- launchApp:
    clearState: true
- runFlow:
    when:
      true: ${PHASE == 'signup'}
    commands:
      - assertVisible: 'Expyrico'
      - tapOn:
          id: 'welcome-sign-up'
      - assertVisible: 'Create your account'
      - tapOn: 'Email'
      - inputText: '${EMAIL}'
      - tapOn: 'Password'
      - inputText: '${PASSWORD}'
      - hideKeyboard
      - scrollUntilVisible:
          element:
            text: 'First name'
          direction: DOWN
      - tapOn: 'First name'
      - inputText: 'Maestro'
      - hideKeyboard
      - scrollUntilVisible:
          element:
            text: 'Last name'
          direction: DOWN
      - tapOn: 'Last name'
      - inputText: 'Tester'
      - hideKeyboard
      - scrollUntilVisible:
          element:
            id: 'sign-up-submit'
          direction: DOWN
      - tapOn:
          id: 'sign-up-submit'
      - assertVisible: 'Verify your email'
- runFlow:
    when:
      true: ${PHASE == 'signin'}
    commands:
      - assertVisible: 'Expyrico'
      - tapOn:
          id: 'welcome-sign-in'
      - assertVisible: 'Welcome back'
      - tapOn: 'Email'
      - inputText: '${EMAIL}'
      - tapOn: 'Password'
      - inputText: '${PASSWORD}'
      - hideKeyboard
      - scrollUntilVisible:
          element:
            id: 'sign-in-submit'
          direction: DOWN
      - tapOn:
          id: 'sign-in-submit'
      - assertVisible: 'Your pantry'
```

CI runs the signup phase, marks that one isolated test account verified in the ephemeral database, clears app state, and runs the signin phase. There is no undefined `${OUTPUT.email}`, random value generated inside the flow, or acceptance of two different outcomes.

- [ ] **Step 4: Add an executable isolated Android E2E job**

Remove the stale development-client comments and add an `ubuntu-latest` job with PostgreSQL 16, Redis 7, and Mailpit service containers. Use `actions/setup-java@v4` with Temurin 17, install dependencies with the frozen lockfile, run Prisma deploy against `postgresql://pantry:pantry@localhost:5432/pantry?schema=public`, and start the API with only CI-local values:

```yaml
  mobile-e2e:
    name: Mobile release APK E2E
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: pantry
          POSTGRES_PASSWORD: pantry
          POSTGRES_DB: pantry
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U pantry -d pantry"
          --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
      mailpit:
        image: axllent/mailpit:v1.30.0
        ports: ['1025:1025', '8025:8025']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - run: pnpm install --frozen-lockfile
      - name: Migrate and start isolated API
        env:
          NODE_ENV: test
          PORT: 4000
          HOST: 0.0.0.0
          LOG_LEVEL: warn
          DATABASE_URL: postgresql://pantry:pantry@localhost:5432/pantry?schema=public
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: ci-only-jwt-secret-at-least-32-characters
          TOTP_ENCRYPTION_KEY: MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=
          GOOGLE_CLIENT_ID: ci-google-client
          APPLE_CLIENT_ID: ci.apple.client
          APPLE_TEAM_ID: CITEAM0001
          APPLE_KEY_ID: CIKEY0001
          WEBAUTHN_RP_ID: localhost
          WEBAUTHN_RP_NAME: Expyrico CI
          WEBAUTHN_ORIGIN: http://localhost:8081
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          SMTP_FROM: Expyrico CI <no-reply@expyrico.test>
          ADMIN_URL: http://localhost:4001
          COUNTRY_DETECT_PRIMARY: http://127.0.0.1:9
          COUNTRY_DETECT_FALLBACK: http://127.0.0.1:9
          RATE_LIMIT_ENABLED: 'false'
        run: |
          pnpm --filter @expyrico/api db:generate
          pnpm --filter @expyrico/api db:migrate:deploy
          nohup pnpm --filter @expyrico/api exec tsx src/server.ts > api-e2e.log 2>&1 &
          for attempt in $(seq 1 30); do
            curl -fsS http://127.0.0.1:4000/v1/health && exit 0
            sleep 2
          done
          cat api-e2e.log
          exit 1
      - name: Build local release APK
        run: |
          printf '%s\n' 'API_BASE_URL=http://10.0.2.2:4000' > apps/mobile/.env.mobile.local
          cd apps/mobile
          ENVFILE=.env.mobile.local ../../node_modules/@react-native/gradle-plugin/gradlew -p android clean :app:assembleRelease -PallowCleartext=true
      - name: Install and run deterministic Maestro phases
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 35
          arch: x86_64
          disable-animations: true
          script: |
            export MAESTRO_VERSION=2.4.0
            curl -fsSL https://get.maestro.mobile.dev | bash
            export PATH="$HOME/.maestro/bin:$PATH"
            adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
            EMAIL="maestro+${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@expyrico.test"
            PASSWORD='correct-horse-battery-staple'
            maestro test -e PHASE=signup -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" apps/mobile/tests/e2e/sign-up-and-sign-in.yaml
            docker exec "${{ job.services.postgres.id }}" psql -U pantry -d pantry -v ON_ERROR_STOP=1 -c "UPDATE users SET \"emailVerifiedAt\" = NOW() WHERE email = '$EMAIL'"
            adb shell pm clear com.expyrico.app
            maestro test -e PHASE=signin -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" apps/mobile/tests/e2e/sign-up-and-sign-in.yaml
```

Do not point this job at production or reuse production credentials. Update `docs/runbooks/release-checklist.md` so store builds are local signed artifacts and remove the obsolete over-the-air release wording.

- [ ] **Step 5: Prove removal and commit**

Run:

```bash
pnpm verify:no-expo-runtime
pnpm -r why expo
pnpm -r why expo-server-sdk
```

Expected: guard passes; both `pnpm why` commands show no installed package. Optional peer metadata inside third-party package manifests is not an installed Expo runtime.

```bash
git add package.json scripts/verify-no-expo-runtime.mjs .github/workflows/ci.yml README.md AGENTS.md apps/mobile/docs apps/mobile/tests/e2e/sign-up-and-sign-in.yaml docs/code-standards.md docs/codebase-summary.md docs/deployment-guide.md docs/legal/privacy-policy.md docs/project-overview-pdr.md docs/project-roadmap.md docs/runbooks docs/system-architecture.md docs/superpowers
git commit -m "refactor: remove Expo runtime and guidance"
```

### Task 16: Full verification, APK inspection, emulator acceptance, and review

**Files:**
- Modify only if verification exposes migration defects
- Update: `apps/mobile/docs/a11y-manual-checklist.md` with completed device evidence

- [ ] **Step 1: Preflight and pin the local verification tools**

Run on this Mac:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$(ruby -e 'print Gem.user_dir')/bin:$HOME/.maestro/bin:$PATH"
test -x "$JAVA_HOME/bin/java"
adb version
DEXDUMP="$(ls -1 "$ANDROID_HOME"/build-tools/*/dexdump | sort | tail -1)"
test -x "$DEXDUMP"
bundle _2.4.22_ --version
if ! maestro --version 2>/dev/null | rg -q '2\.4\.0'; then
  export MAESTRO_VERSION=2.4.0
  curl -fsSL https://get.maestro.mobile.dev | bash
fi
maestro --version | rg '2\.4\.0'
```

Expected: Java, ADB, the installed Build Tools `dexdump`, Bundler 2.4.22, and Maestro 2.4.0 are available. This replaces the nonexistent `cmdline-tools/latest/bin/apkanalyzer` assumption.

- [ ] **Step 2: Run the complete automated suite**

```bash
pnpm --filter @expyrico/shared build
pnpm --filter @expyrico/shared test
pnpm --filter @expyrico/api typecheck
pnpm --filter @expyrico/api test
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile lint
pnpm --filter @expyrico/mobile test -- --runInBand
pnpm verify:no-expo-runtime
```

Expected: every command passes. Fix migration-caused and touched-file lint failures before continuing; do not suppress them globally.

- [ ] **Step 3: Build both APK variants directly with Gradle**

```bash
cd apps/mobile
ENVFILE=.env.example \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
../../node_modules/@react-native/gradle-plugin/gradlew -p android clean :app:assembleDebug :app:assembleRelease
MERGED_RELEASE_MANIFEST="$(find android/app/build/intermediates -path '*release*' -name AndroidManifest.xml | sort | tail -1)"
test -n "$MERGED_RELEASE_MANIFEST"
rg 'usesCleartextTraffic="false"' "$MERGED_RELEASE_MANIFEST"
```

Expected: debug and release APKs exist under `android/app/build/outputs/apk/`; the normal release manifest rejects cleartext; no Expo CLI, dev server, or cloud build runs.

- [ ] **Step 4: Inspect APK contents**

```bash
APK=android/app/build/outputs/apk/release/app-release.apk
DEXDUMP="$(ls -1 "$ANDROID_HOME"/build-tools/*/dexdump | sort | tail -1)"
DEX_DIR="$(mktemp -d)"
trap 'rm -rf "$DEX_DIR"' EXIT
unzip -q "$APK" 'classes*.dex' -d "$DEX_DIR"
if find "$DEX_DIR" -name 'classes*.dex' -print0 \
  | xargs -0 "$DEXDUMP" \
  | rg -qi 'Lexpo/|Lhost/exp/|devlauncher|expo-updates'; then
  echo 'Forbidden runtime classes found in release APK' >&2
  exit 1
fi
if unzip -l "$APK" \
  | rg -qi 'expo|dev-launcher|expo-updates'; then
  echo 'Forbidden runtime assets found in release APK' >&2
  exit 1
fi
```

Expected: both guards exit successfully because neither classes nor packaged assets match.

- [ ] **Step 5: Install on a clean emulator**

```bash
adb -e uninstall host.exp.exponent || true
adb -e uninstall com.expyrico.app || true
adb -e install android/app/build/outputs/apk/release/app-release.apk
adb -e shell monkey -p com.expyrico.app -c android.intent.category.LAUNCHER 1
if adb -e shell pm list packages | rg -q 'host\.exp\.exponent|expo'; then
  echo 'Forbidden launcher/runtime package remains installed' >&2
  exit 1
fi
```

Expected: Expyrico launches without Metro; the final package search returns no matches. This APK uses the non-routable `.env.example` URL, so limit this step to launch/render/navigation smoke and do not submit an authentication or data-mutating form.

- [ ] **Step 6: Execute visual/navigation acceptance against an isolated local API**

From the repository root, start disposable services on dedicated loopback ports and an API on port 4400. These fixed names make cleanup deterministic; fail rather than reusing an unknown listener:

```bash
cd "$(git rev-parse --show-toplevel)"
docker rm -f expyrico-acceptance-postgres expyrico-acceptance-redis expyrico-acceptance-mailpit >/dev/null 2>&1 || true
for port in 4400 55432 56379 51025 58025; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null; then
    echo "Acceptance port $port is already in use" >&2
    exit 1
  fi
done
docker run -d --rm --name expyrico-acceptance-postgres \
  -e POSTGRES_USER=pantry -e POSTGRES_PASSWORD=pantry -e POSTGRES_DB=pantry \
  -p 127.0.0.1:55432:5432 postgres:16
docker run -d --rm --name expyrico-acceptance-redis \
  -p 127.0.0.1:56379:6379 redis:7
docker run -d --rm --name expyrico-acceptance-mailpit \
  -p 127.0.0.1:51025:1025 -p 127.0.0.1:58025:8025 axllent/mailpit:v1.30.0
until docker exec expyrico-acceptance-postgres pg_isready -U pantry -d pantry; do sleep 1; done
DATABASE_URL='postgresql://pantry:pantry@127.0.0.1:55432/pantry?schema=public' \
  pnpm --filter @expyrico/api db:generate
DATABASE_URL='postgresql://pantry:pantry@127.0.0.1:55432/pantry?schema=public' \
  pnpm --filter @expyrico/api db:migrate:deploy
nohup env \
  NODE_ENV=test PORT=4400 HOST=0.0.0.0 LOG_LEVEL=warn \
  DATABASE_URL='postgresql://pantry:pantry@127.0.0.1:55432/pantry?schema=public' \
  REDIS_URL='redis://127.0.0.1:56379' \
  JWT_ACCESS_SECRET='acceptance-only-jwt-secret-at-least-32-characters' \
  TOTP_ENCRYPTION_KEY='MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=' \
  GOOGLE_CLIENT_ID='acceptance-google-client' APPLE_CLIENT_ID='acceptance.apple.client' \
  APPLE_TEAM_ID='ACCEPT0001' APPLE_KEY_ID='ACCEPTKEY1' \
  WEBAUTHN_RP_ID=localhost WEBAUTHN_RP_NAME='Expyrico Acceptance' \
  WEBAUTHN_ORIGIN='http://localhost:8081' \
  SMTP_HOST=127.0.0.1 SMTP_PORT=51025 \
  SMTP_FROM='Expyrico Acceptance <no-reply@expyrico.test>' \
  ADMIN_URL='http://localhost:4401' \
  COUNTRY_DETECT_PRIMARY='http://127.0.0.1:9' COUNTRY_DETECT_FALLBACK='http://127.0.0.1:9' \
  RATE_LIMIT_ENABLED=false \
  pnpm --filter @expyrico/api exec tsx src/server.ts \
  >/tmp/expyrico-acceptance-api.log 2>&1 &
echo $! >/tmp/expyrico-acceptance-api.pid
for attempt in $(seq 1 30); do
  curl -fsS http://127.0.0.1:4400/v1/health && break
  if [ "$attempt" -eq 30 ]; then cat /tmp/expyrico-acceptance-api.log; exit 1; fi
  sleep 2
done
printf '%s\n' 'API_BASE_URL=http://10.0.2.2:4400' > apps/mobile/.env.mobile.local
cd apps/mobile
ENVFILE=.env.mobile.local \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
../../node_modules/@react-native/gradle-plugin/gradlew \
  -p android clean :app:assembleRelease -PallowCleartext=true
ACCEPTANCE_MANIFEST="$(find android/app/build/intermediates -path '*release*' -name AndroidManifest.xml | sort | tail -1)"
rg 'usesCleartextTraffic="true"' "$ACCEPTANCE_MANIFEST"
adb -e install -r android/app/build/outputs/apk/release/app-release.apk
```

Use this acceptance APK for every submitted form. First run the deterministic signup/signin phases from Task 15, using the isolated database only:

```bash
EMAIL="maestro+local-$(date +%s)@expyrico.test"
PASSWORD='correct-horse-battery-staple'
maestro test -e PHASE=signup -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" tests/e2e/sign-up-and-sign-in.yaml
docker exec expyrico-acceptance-postgres psql -U pantry -d pantry -v ON_ERROR_STOP=1 \
  -c "UPDATE users SET \"emailVerifiedAt\" = NOW() WHERE email = '$EMAIL'"
adb -e shell pm clear com.expyrico.app
maestro test -e PHASE=signin -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" tests/e2e/sign-up-and-sign-in.yaml
```

For the manual email-verification and password-reset passes, use a second disposable `@expyrico.test` account and retrieve its six-digit codes only from the local Mailpit UI at `http://127.0.0.1:58025`. Prove the verification code, reset code, reset ticket, new password, and subsequent sign-in all stay inside this isolated stack. Never substitute a production or shared staging URL for this step.

Use ADB/UIAutomator or Maestro to verify:

```text
Welcome: Create account and Sign in are both visible, bounded, and tappable.
Auth: sign-up -> email OTP; sign-in; forgot -> reset OTP -> reset password; Back behavior.
Tabs: Home, Giveaways, Deals, Browse, Reviews, Profile all open and retain state.
Stacks: scan, product create/detail/review, record detail, deal create/edit/detail, giveaway create/mine/detail/manage/rate, household, invite, report, settings, appearance, passkey, notifications, account.
Theme: System follows emulator light/dark; Light and Dark manual overrides persist.
Camera: deny/grant/retry, barcode/QR callback, OCR capture/manual fallback.
Referral: cold and running `expyrico://invite?code=ABCDEF23` capture the code; invalid values are ignored.
```

Capture light/dark screenshots and UI hierarchy dumps for Welcome, Home, Pantry/Browse, a community screen, Settings, and OTP.

After capturing evidence, stop the isolated stack, remove its ignored config, and rebuild the final non-cleartext, non-routable smoke APK so the acceptance-only artifact is not left as the release output:

```bash
cd "$(git rev-parse --show-toplevel)"
if test -f /tmp/expyrico-acceptance-api.pid; then
  kill "$(cat /tmp/expyrico-acceptance-api.pid)" 2>/dev/null || true
fi
docker rm -f expyrico-acceptance-postgres expyrico-acceptance-redis expyrico-acceptance-mailpit
rm -f /tmp/expyrico-acceptance-api.pid /tmp/expyrico-acceptance-api.log apps/mobile/.env.mobile.local
cd apps/mobile
ENVFILE=.env.example \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
../../node_modules/@react-native/gradle-plugin/gradlew -p android clean :app:assembleRelease
FINAL_MANIFEST="$(find android/app/build/intermediates -path '*release*' -name AndroidManifest.xml | sort | tail -1)"
rg 'usesCleartextTraffic="false"' "$FINAL_MANIFEST"
```

- [ ] **Step 7: Verify credential-dependent native services**

With a dedicated non-production Firebase project, the isolated/staging API, untracked Firebase platform files, and Application Default Credentials present, verify permission denial/grant, initial token registration, refresh, foreground receipt, background system notification, tap-to-launch/resume, server invalid-token revocation, and logout registration cleanup. On a signed iOS device built with a reviewed `.env.mobile.local`, also verify Google sign-in returns through `GOOGLE_IOS_URL_SCHEME` and a passkey can be registered and used after confirming the AASA file contains `<APPLE_TEAM_ID>.com.expyrico.app`.

Inspect the exact signed `.app` used for that device test:

```bash
SIGNED_APP=/absolute/path/to/signed/Expyrico.app
test -f "$SIGNED_APP/GoogleService-Info.plist"
ENTITLEMENTS="$(mktemp)"
trap 'rm -f "$ENTITLEMENTS"' EXIT
codesign -d --entitlements :- "$SIGNED_APP" > "$ENTITLEMENTS" 2>/dev/null
/usr/libexec/PlistBuddy -c 'Print :aps-environment' "$ENTITLEMENTS"
/usr/libexec/PlistBuddy -c 'Print :com.apple.developer.applesignin:0' "$ENTITLEMENTS" | rg '^Default$'
/usr/libexec/PlistBuddy -c 'Print :com.apple.developer.associated-domains:0' "$ENTITLEMENTS" | rg '^webcredentials:'
```

Expected: the signed product embeds the externally supplied Firebase plist and all three target capabilities. If credentials/domain association are not supplied, automated adapter/server tests must still pass and the handoff must list FCM, Google iOS callback, and signed-device passkey verification as external gates.

- [ ] **Step 8: Verify iOS compilation**

```bash
export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/apps/mobile/ios"
ENVFILE=.env.example bundle _2.4.22_ exec pod install
ENVFILE=.env.example xcodebuild -workspace Expyrico.xcworkspace -scheme Expyrico -configuration Debug -sdk iphonesimulator -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
APP=build/DerivedData/Build/Products/Debug-iphonesimulator/Expyrico.app
test -f "$APP/Ionicons.ttf"
test ! -f "$APP/GoogleService-Info.plist"
plutil -extract UIAppFonts json -o - "$APP/Info.plist" | rg 'Ionicons\.ttf'
xcodebuild -workspace Expyrico.xcworkspace -scheme Expyrico -configuration Debug -showBuildSettings \
  | rg 'CODE_SIGN_ENTITLEMENTS = Expyrico/Expyrico\.entitlements'
```

Expected: build succeeds with no Expo pod, script phase, or import; the built app bundles Ionicons, declares it in `UIAppFonts`, omits absent Firebase configuration, and uses the checked-in entitlements file.

- [ ] **Step 9: Request two-stage review**

Run a spec-compliance review against every acceptance criterion, then a code-quality/security review covering navigation type safety, token storage, Firebase credential handling, push token ownership/revocation, native configuration, accessibility, and theme parity. Resolve all blocking findings and rerun affected verification.

- [ ] **Step 10: Commit any review fixes explicitly**

If Step 9 changed code/configuration, inspect `git status --short`, stage only those exact reviewed paths, commit them as `fix(mobile): resolve bare migration review`, and rerun every affected command from Steps 1–8. Skip this step when the review required no changes.

- [ ] **Step 11: Final evidence commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add apps/mobile/docs/a11y-manual-checklist.md
git commit -m "test(mobile): verify bare native release"
git status --short
```

Expected: worktree is clean and the branch contains only reviewed migration changes.
