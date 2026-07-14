# Expyrico Mobile Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a consistent, accessible Expyrico light/dark experience across every mobile route.

**Architecture:** ThemeProvider remains the sole resolver. System, Light, and Dark are the only user-selectable preferences. Shared theme-aware controls replace route-local styling; API, navigation, session, and data behavior do not change.

**Tech Stack:** React Native, Expo Router, TypeScript, Jest/RNTL, Expo vector icons, Expyrico theme package, Android Gradle/ADB.

---

## Guardrails

- Start with the current dirty tree. Review the existing welcome, OTP, home, RecordList, snapshot, API, and CLAUDE diffs before overlapping edits.
- Never reset, checkout, stage, or commit unrelated existing changes.
- Preserve test IDs, route paths, auth states, requests, and domain behavior.
- Do not ship the .superpowers visual-companion files.

## File map

| Area | Files |
| --- | --- |
| Appearance | apps/mobile/src/auth/secure-store.ts; src/theme/store.ts; src/theme/ThemeProvider.tsx; app/(app)/settings/theme.tsx |
| Shared controls | apps/mobile/src/components/Button.tsx, Screen.tsx, TextField.tsx, OtpInput.tsx, EmptyState.tsx |
| Navigation | apps/mobile/app/(app)/(tabs)/_layout.tsx |
| Auth | apps/mobile/app/(auth)/*.tsx and route tests |
| Pantry | tabs, scan, record, product routes; src/features/records and expiry |
| Community/account | deal, giveaway, invite, report, profile, household, settings routes and their feature folders |
| Tests | theme tests, route tests, unit touch tests, snapshots |

### Task 1: Record a safe baseline

**Files:** inspect current modified files only; do not modify production files.

- [ ] **Step 1: Record current changes and focused test baseline.**

~~~bash
git status --short
git diff -- apps/mobile/app/(auth)/verify-email.tsx apps/mobile/app/(auth)/welcome.tsx apps/mobile/app/(app)/(tabs)/home.tsx
pnpm --dir apps/mobile test -- --runInBand src/theme/ThemeProvider.test.tsx __tests__/routes/verify-email.test.tsx tests/snapshots/home.test.tsx
~~~

Expected: an evidence record of pre-existing changes and test state.

- [ ] **Step 2: Prove the baseline Android build.**

~~~bash
cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
~~~

Expected: BUILD SUCCESSFUL.

### Task 2: Restrict appearance controls

**Files:** modify secure-store.ts, theme/store.ts, app/(app)/settings/theme.tsx. Test src/theme/store.test.ts and __tests__/routes/theme.test.tsx.

- [ ] **Step 1: Write the failing tests.**

~~~ts
test('shows only System, Light, and Dark appearance choices', () => {
  const screen = render(<ThemeSettings />);
  expect(screen.getByTestId('theme-card-system')).toBeTruthy();
  expect(screen.getByTestId('theme-card-expyrico')).toBeTruthy();
  expect(screen.getByTestId('theme-card-expyricoDark')).toBeTruthy();
  expect(screen.queryByTestId('theme-card-bento')).toBeNull();
});

test('persists the Dark override', async () => {
  await useThemeStore.getState().setTheme('expyricoDark');
  expect(useThemeStore.getState().themeId).toBe('expyricoDark');
});
~~~

- [ ] **Step 2: Run RED.**

~~~bash
pnpm --dir apps/mobile test -- --runInBand src/theme/store.test.ts __tests__/routes/theme.test.tsx
~~~

Expected: FAIL because ThemeSettings maps every themeList item.

- [ ] **Step 3: Implement the exact three-option contract.**

Replace themeList mapping with an explicit system, expyrico (Light), and expyricoDark (Dark) list. Restrict persisted preference validation to those IDs. Keep ThemeProvider current useColorScheme resolution when system is selected; do not remove package exports.

- [ ] **Step 4: Run GREEN and commit.**

~~~bash
pnpm --dir apps/mobile test -- --runInBand src/theme/store.test.ts __tests__/routes/theme.test.tsx
pnpm --dir apps/mobile typecheck
git add apps/mobile/src/auth/secure-store.ts apps/mobile/src/theme/store.ts apps/mobile/app/(app)/settings/theme.tsx apps/mobile/src/theme/store.test.ts apps/mobile/__tests__/routes/theme.test.tsx
git commit -m "feat(mobile): limit appearance to system light and dark"
~~~

### Task 3: Complete shared controls

**Files:** modify Button.tsx, Screen.tsx, TextField.tsx, OtpInput.tsx, EmptyState.tsx. Test touch-target.test.ts and component snapshots.

- [ ] **Step 1: Write failing controls tests.**

~~~ts
test('outline controls retain a 52dp touch target', () => {
  const { getByRole } = render(<Button label="Resend code" variant="outline" onPress={jest.fn()} />);
  expect(getByRole('button', { name: 'Resend code' }).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ minHeight: 52 })]),
  );
});

test('OTP keeps a labelled native input in dark mode', () => {
  const screen = renderWithTheme(<OtpInput label="Verification code" value="" onChangeText={jest.fn()} />, 'expyricoDark');
  expect(screen.getByLabelText('Verification code')).toBeTruthy();
});
~~~

- [ ] **Step 2: Run RED, then implement semantic variants.**

~~~bash
pnpm --dir apps/mobile test -- --runInBand tests/unit/touch-target.test.ts tests/snapshots/components/MD3.test.tsx
~~~

Primary means Honey fill; secondary Fresh Sage fill; outline Fresh Sage border; ghost compact tertiary; danger Alert Red. Keep all actions 52dp, fields/cells 48dp+, and all shared surfaces token-driven.

- [ ] **Step 3: Run GREEN and commit.**

~~~bash
pnpm --dir apps/mobile test -- --runInBand tests/unit/touch-target.test.ts tests/snapshots/components
pnpm --dir apps/mobile lint
git add apps/mobile/src/components apps/mobile/tests/unit/touch-target.test.ts apps/mobile/tests/snapshots/components
git commit -m "feat(mobile): unify Expyrico controls"
~~~

### Task 4: Apply shared hierarchy to auth

**Files:** all app/(auth) routes, their route tests, welcome/sign-in snapshots.

- [ ] **Step 1: Add failing OTP recovery test.**

~~~ts
test('verification renders designed resend and change-email actions', () => {
  const screen = render(<VerifyEmail />);
  expect(screen.getByTestId('verify-resend')).toBeTruthy();
  expect(screen.getByTestId('verify-change-email')).toBeTruthy();
});
~~~

- [ ] **Step 2: Run RED.**

~~~bash
pnpm --dir apps/mobile test -- --runInBand __tests__/routes/verify-email.test.tsx __tests__/routes/sign-in.test.tsx
~~~

- [ ] **Step 3: Implement and verify.**

Use the shared Logo, Screen, Button, TextField, and OtpInput. OTP has code cells, time notice, Honey verify, icon-bearing outline resend, then ghost change email. Reuse same header/form/action rhythm for welcome, sign-in, sign-up, forgot/reset password, and reset-code without changing cooldown/autofill/loading/navigation.

~~~bash
pnpm --dir apps/mobile test -- --runInBand __tests__/routes/sign-in.test.tsx __tests__/routes/sign-up.test.tsx __tests__/routes/forgot-password.test.tsx __tests__/routes/reset-password.test.tsx __tests__/routes/verify-reset-code.test.tsx __tests__/routes/verify-email.test.tsx tests/snapshots/welcome.test.tsx tests/snapshots/sign-in.test.tsx -u
git add apps/mobile/app/(auth) apps/mobile/__tests__/routes apps/mobile/tests/snapshots
git commit -m "feat(mobile): unify authentication screens"
~~~

### Task 5: Apply shared hierarchy to tabs and pantry

**Files:** tab layout/home/browse/reviews; scan/record/product routes; records and expiry features; home/browse/product/reviews snapshots; AddRecordForm and ScanCamera tests.

- [ ] **Step 1: Write failing tab/home tests.**

~~~ts
test('tab controls are labelled', () => {
  const screen = render(<TabsLayout />);
  expect(screen.getByLabelText('Home')).toBeTruthy();
  expect(screen.getByLabelText('Browse')).toBeTruthy();
});

test('home exposes scan as its item action when records exist', () => {
  expect(render(<HomeTab />).getByTestId('home-fab-add')).toBeTruthy();
});
~~~

- [ ] **Step 2: Run RED, implement, verify, and commit.**

Keep six routes and FloatingTabBar routing. Render icon + label tabs with a semantic active pill and 48dp targets. Standardize UseNextHero, expiry status, record list, scan action, browse, scan prompt, record/product details, new product, and reviews with shared cards/rows/statuses. Retain FlatList/memoization.

~~~bash
pnpm --dir apps/mobile test -- --runInBand tests/snapshots/home.test.tsx tests/snapshots/browse.test.tsx tests/snapshots/product.test.tsx tests/snapshots/reviews.test.tsx src/tests/AddRecordForm.test.tsx src/tests/ScanCamera.test.tsx -u
pnpm --dir apps/mobile lint
git add apps/mobile/app/(app)/(tabs) apps/mobile/app/(app)/scan.tsx apps/mobile/app/(app)/record apps/mobile/app/(app)/product apps/mobile/src/features/records apps/mobile/src/features/expiry apps/mobile/tests
git commit -m "feat(mobile): unify pantry workflows"
~~~

### Task 6: Apply shared hierarchy to community and account

**Files:** deal, giveaway, invite, report, profile, household, settings/passkey routes; deals/giveaways/referral/households features; associated tests.

- [ ] **Step 1: Write failing card/settings tests.**

~~~ts
test('deal card has an accessible action', () => {
  expect(render(<DealCard deal={dealFixture} onPress={jest.fn()} />).getByRole('button')).toBeTruthy();
});

test('appearance exposes three radio controls', () => {
  expect(render(<ThemeSettings />).getAllByRole('radio')).toHaveLength(3);
});
~~~

- [ ] **Step 2: Run RED, implement, verify, and commit.**

Use shared cards, rows, buttons, fields, status badges, empty/error/loading states. Preserve transactions, voting, claims, invites, reporting, passkeys, and household behavior. Retry is offered only when a current retry callback exists.

~~~bash
pnpm --dir apps/mobile test -- --runInBand __tests__/DealCard.test.tsx __tests__/DealForm.test.tsx __tests__/ReferralCodeCard.test.tsx __tests__/InviteShareButton.test.tsx __tests__/routes/settings-index.test.tsx tests/snapshots/settings.test.tsx -u
pnpm --dir apps/mobile typecheck
git add apps/mobile/app/(app) apps/mobile/src/features/deals apps/mobile/src/features/giveaways apps/mobile/src/features/referral apps/mobile/src/features/households apps/mobile/__tests__ apps/mobile/tests
git commit -m "feat(mobile): unify community and account screens"
~~~

### Task 7: Verify on Android

**Files:** modify tests/snapshots only for evidence-based corrections.

- [ ] **Step 1: Run the full quality gate.**

~~~bash
pnpm --dir apps/mobile lint
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test -- --runInBand
~~~

Expected: all commands exit 0.

- [ ] **Step 2: Build, install, and inspect both appearances.**

~~~bash
cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb exec-out screencap -p > /tmp/expyrico-light.png
# Switch Android to dark appearance, return to app:
adb exec-out screencap -p > /tmp/expyrico-dark.png
~~~

Expected: Gradle BUILD SUCCESSFUL and ADB Success. Inspect welcome, OTP, home, browse, detail, and Settings in both appearances. Layout must remain stable, status colors semantic, controls 48dp+, error/loading recovery intact, Android back functional, and Alert Red absent from branding.

- [ ] **Step 3: Final scope check.**

~~~bash
git diff --check
git status --short
codegraph affected apps/mobile
~~~

Stage only final corrective files after confirming no unrelated existing changes are included.

## Coverage

- System/manual appearance: Task 2.
- Palette and shared controls: Task 3.
- All auth pages and OTP: Task 4.
- Tabs, Home, pantry, scan, product, reviews: Task 5.
- Deals, giveaways, referrals, report, profile, household, settings: Task 6.
- Test, build, ADB evidence: Task 7.

