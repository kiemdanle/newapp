# Android Scan and Passkey Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make passkey login, Android camera permission, barcode product creation, duplicate protection, product naming, OCR expiry scanning, native date selection, and login capitalization reliable on the connected Mi 9.

**Architecture:** Keep the fixes mobile-first and surgical. Reuse existing API and WatermelonDB contracts: usernameless passkey options use the server's existing challenge fallback, product names are stored as record snapshots for new records and fetched through the existing cached product query for legacy records, and duplicate checks remain local/offline-first.

**Tech Stack:** React Native 0.76, TypeScript, React Navigation 7, TanStack Query 5, WatermelonDB, Vision Camera 4.7.2, ML Kit text recognition, React Native DateTimePicker 8.4.4, Jest/RNTL, Android Gradle/ADB.

---

### Task 1: Passkey discovery and capitalization-safe login

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-in.tsx`
- Modify: `apps/mobile/src/auth/passkey.ts`
- Test: `apps/mobile/__tests__/routes/sign-in.test.tsx`
- Create: `apps/mobile/src/auth/passkey.test.ts`

- [ ] **Step 1: Write failing sign-in input tests**

Add an RNTL test that renders `SignIn`, obtains the Email and Password inputs, and asserts both have `autoCapitalize: 'none'` and `autoCorrect: false`.

```tsx
it('disables capitalization and autocorrect for login credentials', () => {
  const { getByLabelText } = render(wrap(<SignIn />));
  expect(getByLabelText('Email').props.autoCapitalize).toBe('none');
  expect(getByLabelText('Email').props.autoCorrect).toBe(false);
  expect(getByLabelText('Password').props.autoCapitalize).toBe('none');
  expect(getByLabelText('Password').props.autoCorrect).toBe(false);
});
```

- [ ] **Step 2: Write a failing passkey-options test**

Mock `authEndpoints.passkeyLoginOptions`, `authEndpoints.passkeyLoginVerify`, and `Passkey.get`. Call `signInWithPasskey()` and assert options are requested without an email/allow-list binding and the returned assertion is verified.

```ts
expect(authEndpoints.passkeyLoginOptions).toHaveBeenCalledWith(undefined);
expect(Passkey.get).toHaveBeenCalledWith(expect.objectContaining({ rpId: 'api.linhkienkts.com' }));
```

- [ ] **Step 3: Run the auth tests and verify RED**

Run:

```bash
pnpm --filter @expyrico/mobile test -- --runInBand __tests__/routes/sign-in.test.tsx src/auth/passkey.test.ts
```

Expected: FAIL because the password field lacks keyboard props and passkey login still sends the account email.

- [ ] **Step 4: Implement the minimal auth changes**

Set `autoCorrect={false}` on Email and Password and `autoCapitalize="none"` on Password. Change passkey sign-in to request discoverable options:

```ts
const options = await authEndpoints.passkeyLoginOptions();
```

Keep the UI email validation and lowercase normalization so the user explicitly identifies the intended account before opening Credential Manager.

- [ ] **Step 5: Run auth tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit the auth fix**

```bash
git add 'apps/mobile/app/(auth)/sign-in.tsx' apps/mobile/src/auth/passkey.ts apps/mobile/__tests__/routes/sign-in.test.tsx apps/mobile/src/auth/passkey.test.ts
git commit -m "fix(mobile): make passkey and credential login reliable"
```

### Task 2: Correct Android camera-permission state flow

**Files:**
- Modify: `apps/mobile/src/features/scan/usePermission.ts`
- Modify: `apps/mobile/app/(app)/scan.tsx`
- Create: `apps/mobile/src/tests/useCameraPermission.test.tsx`
- Create: `apps/mobile/__tests__/routes/scan.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Render a test harness around `useCameraPermission`. Mock `Camera.getCameraPermissionStatus()` as `not-determined`, then `Camera.requestCameraPermission()` as `granted`, and assert the hook preserves both states in order. Add cases for `denied` and `restricted`.

- [ ] **Step 2: Write failing route tests**

Assert the route shows `PrePromptModal` for `not-determined`, invokes `request()` on Allow, and renders an `Open settings` action for `denied`/`restricted` that calls `Linking.openSettings()`.

- [ ] **Step 3: Run permission tests and verify RED**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand src/tests/useCameraPermission.test.tsx __tests__/routes/scan.test.tsx
```

Expected: FAIL because all non-granted statuses currently map to `denied` and no settings action exists.

- [ ] **Step 4: Preserve native permission states**

Define:

```ts
export type PermissionState = 'unknown' | 'not-determined' | 'granted' | 'denied' | 'restricted';
```

Map Vision Camera statuses without collapsing them. In the route, show the explanatory prompt for `not-determined`; show `Open settings` and `Go back` for `denied`/`restricted`.

- [ ] **Step 5: Run permission tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit the permission fix**

```bash
git add apps/mobile/src/features/scan/usePermission.ts 'apps/mobile/app/(app)/scan.tsx' apps/mobile/src/tests/useCameraPermission.test.tsx apps/mobile/__tests__/routes/scan.test.tsx
git commit -m "fix(mobile): request Android camera permission correctly"
```

### Task 3: Native expiry picker, OCR prefill, and duplicate confirmation

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/api/records.ts`
- Test: `apps/mobile/src/tests/AddRecordForm.test.tsx`

- [ ] **Step 1: Install the native date-picker dependency**

```bash
pnpm --filter @expyrico/mobile add @react-native-community/datetimepicker@8.4.4
```

Expected: package and lockfile update without Expo/EAS changes.

- [ ] **Step 2: Write failing date and prefill tests**

Mock `DateTimePickerAndroid.open`. Render with `initialExpiry="2026-08-31"`, assert that date is visible, press `add-record-expiry-select`, invoke the picker callback with a selected local date, and assert `createLocalRecord` receives its `YYYY-MM-DD` value.

- [ ] **Step 3: Write failing duplicate tests**

Mock a new `findActiveProductRecords(productId, householdId)` helper. When it returns an existing record, pressing Save must show `Alert.alert` and not create immediately. Invoke the `Add with different expiry` action and assert one record is created. Add a no-duplicate case that saves directly.

- [ ] **Step 4: Run form tests and verify RED**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand src/tests/AddRecordForm.test.tsx
```

Expected: FAIL because the form has no initial expiry, date-picker button, or duplicate check.

- [ ] **Step 5: Implement local duplicate lookup**

Add a focused records API helper querying active, non-deleted rows by `product_id` and effective `household_id`:

```ts
export async function findActiveProductRecords(productId: string, householdId: string | null) {
  const conditions = [
    Q.where('product_id', productId),
    Q.where('status', 'active'),
    Q.where('pending_delete', false),
    Q.where('household_id', householdId),
  ];
  return database.get<RecordModel>('records').query(...conditions).fetch();
}
```

- [ ] **Step 6: Implement the native picker and confirmation**

Add `initialExpiry?: string | null`. Sync a changed non-null prop into state. Replace editable expiry input with a Pressable displaying the ISO date and open `DateTimePickerAndroid` on Android. Before creation, call the duplicate helper and use:

```ts
Alert.alert(
  'Product already in pantry',
  `${productName ?? 'This product'} is already active. Is this another package with a different expiry date?`,
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Add with different expiry', onPress: createRecord },
  ],
);
```

Store `customName: productName ?? customName ?? 'Item'` even when `productId` exists.

- [ ] **Step 7: Run form tests and verify GREEN**

Run the command from Step 4. Expected: PASS.

- [ ] **Step 8: Commit the record-form fix**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/features/records/AddRecordForm.tsx apps/mobile/src/api/records.ts apps/mobile/src/tests/AddRecordForm.test.tsx
git commit -m "fix(mobile): add native expiry and duplicate checks"
```

### Task 4: Repair OCR file handling and direct date insertion

**Files:**
- Modify: `apps/mobile/src/features/expiry/OcrCamera.tsx`
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Create: `apps/mobile/src/tests/OcrCamera.test.tsx`
- Create: `apps/mobile/__tests__/routes/product-detail.test.tsx`

- [ ] **Step 1: Write failing OCR URI test**

Mock `takePhoto()` as `{ path: '/data/user/0/com.expyrico.app/cache/photo.jpg' }`, capture, and assert:

```ts
expect(TextRecognition.recognize).toHaveBeenCalledWith(
  'file:///data/user/0/com.expyrico.app/cache/photo.jpg',
);
```

- [ ] **Step 2: Write failing product prefill test**

Mock `OcrCamera` so `onParsed('2026-09-15')` can be fired. Assert the subsequently rendered `AddRecordForm` receives `initialExpiry="2026-09-15"` and remove the old “enter above” hint expectation.

- [ ] **Step 3: Run OCR tests and verify RED**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand src/tests/OcrCamera.test.tsx __tests__/routes/product-detail.test.tsx
```

Expected: FAIL because OCR receives a bare path and ProductDetail does not pass the parsed value into the form.

- [ ] **Step 4: Implement URI normalization and prefill**

Use `photo.path.startsWith('file://') ? photo.path : \`file://${photo.path}\`` before recognition. Pass `initialExpiry={prefillDate}` to `AddRecordForm` and remove the hint that asks users to re-enter the scanned date.

- [ ] **Step 5: Run OCR tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit the OCR fix**

```bash
git add apps/mobile/src/features/expiry/OcrCamera.tsx 'apps/mobile/app/(app)/product/[id].tsx' apps/mobile/src/tests/OcrCamera.test.tsx apps/mobile/__tests__/routes/product-detail.test.tsx
git commit -m "fix(mobile): apply scanned expiry dates"
```

### Task 5: Correct product names and non-blocking save completion

**Files:**
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`
- Modify: `apps/mobile/app/(app)/product/new.tsx`
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Create: `apps/mobile/src/tests/RecordCard.test.tsx`
- Create: `apps/mobile/__tests__/routes/new-product.test.tsx`

- [ ] **Step 1: Write failing legacy-name test**

Mock `useProduct('product-1')` to return `{ data: { name: 'Fresh Milk' } }`. Render a record with `productId: 'product-1'` and `customName: null`; assert `Fresh Milk` is visible instead of `Item`.

- [ ] **Step 2: Write failing save-completion tests**

Mock `ensurePushTokenRegistered` to reject. Invoke the `onSaved` callback passed to `AddRecordForm` and assert `navigation.replace('Tabs')` still runs and `ToastAndroid.show('Added to pantry', ToastAndroid.SHORT)` is called.

- [ ] **Step 3: Run display/completion tests and verify RED**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand src/tests/RecordCard.test.tsx __tests__/routes/new-product.test.tsx __tests__/routes/product-detail.test.tsx
```

Expected: FAIL because cards do not query product names and navigation waits for push registration.

- [ ] **Step 4: Implement cached legacy name resolution**

Call `useProduct(record.productId ?? undefined)` in `RecordCard` and render:

```tsx
{record.customName ?? product?.name ?? 'Item'}
```

Add an accessibility label built from the same resolved name, quantity, unit, and expiry date so screen readers do not announce `Item` for legacy product-backed records.

- [ ] **Step 5: Implement immediate completion**

Create a small route-local handler in both product screens:

```ts
ToastAndroid.show('Added to pantry', ToastAndroid.SHORT);
navigation.replace('Tabs');
void ensurePushTokenRegistered().catch(() => undefined);
```

The callback must not await Firebase before navigation.

- [ ] **Step 6: Run display/completion tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit product display/completion fixes**

```bash
git add apps/mobile/src/features/records/RecordCard.tsx 'apps/mobile/app/(app)/product/new.tsx' 'apps/mobile/app/(app)/product/[id].tsx' apps/mobile/src/tests/RecordCard.test.tsx apps/mobile/__tests__/routes/new-product.test.tsx apps/mobile/__tests__/routes/product-detail.test.tsx
git commit -m "fix(mobile): show product names and complete saves"
```

### Task 6: Full verification and Mi 9 installation

**Files:**
- Verify only; do not change unrelated files.

- [ ] **Step 1: Run the complete mobile test suite**

```bash
pnpm --filter @expyrico/mobile test -- --runInBand
```

Expected: all tests PASS with no unhandled rejection.

- [ ] **Step 2: Run typecheck and lint**

```bash
pnpm --filter @expyrico/mobile typecheck
pnpm --filter @expyrico/mobile lint
```

Expected: both exit 0.

- [ ] **Step 3: Build with the local Android toolchain**

```bash
cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL` and `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 4: Install without clearing app data**

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Expected: `Success`.

- [ ] **Step 5: Verify device flows**

Use `adb shell pm revoke com.expyrico.app android.permission.CAMERA` before the permission check. Verify the Android dialog appears, barcode creation returns Home with confirmation, duplicate add requires confirmation, product names render, OCR writes the date, and native date picker selects a date. Sign out, enter the supplied account email, tap Use a passkey, and enter the user-supplied device PIN only in the system prompt.

- [ ] **Step 6: Review the final diff**

```bash
git status --short
git diff --check HEAD~5..HEAD
```

Expected: only planned files changed and no whitespace errors.
