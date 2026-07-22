# Android Scan and Passkey Reliability Design

## Scope

Fix the seven reported Android pantry-scan problems and prevent Android keyboard capitalization from causing login failures. Verification targets the connected Xiaomi Mi 9 running Android 11.

## Confirmed causes

- Passkey registration receives three excluded credential IDs and Google Password Manager confirms that one exists. Passkey login sends the same account-scoped allow-list, but Credential Manager finds no local match and offers only a different-device flow.
- Camera permission state collapses `not-determined`, `denied`, and `restricted` into `denied`. The initial Android permission request is therefore skipped.
- New records save locally before awaiting Firebase push-token registration. Firebase is not configured in the installed build, so that follow-up rejects before navigation and no success state appears.
- Product-backed records deliberately store `customName` as `null`, while pantry cards render only `customName`, causing the `Item` fallback.
- Record creation does not check for an active record with the same product in the selected pantry.
- OCR passes a bare Android filesystem path to ML Kit, which expects a URI, and the parsed result is shown only as a hint instead of updating the form.
- Expiry dates use a free-form text input rather than the native date selector.
- The password input allows keyboard defaults that can capitalize the first character.

## Design

### Authentication

Passkey login will request usernameless authentication options so Google Password Manager can discover the existing synced credential for the relying party. The server already stores the challenge by challenge value and resolves the returned credential ID during verification, so this does not weaken account binding. Registration retains its exclusion list to prevent accidental duplicate credentials.

Email and password inputs will set `autoCapitalize="none"` and `autoCorrect={false}`. Tests will verify these props and preserve lowercase email normalization for passkey login.

### Camera permission

The app permission hook will preserve Vision Camera's four statuses: `granted`, `not-determined`, `denied`, and `restricted`. The explanatory pre-prompt appears for `not-determined`; accepting it calls the native request API. A denied permission screen offers an Open Settings action because Vision Camera cannot re-request once Android reports `denied`. Restricted state receives the same settings guidance.

### Add-product completion and names

Saving a record navigates to Home immediately and shows `Added to pantry`. Push-token registration runs as best-effort follow-up and cannot block navigation.

Product-backed records store the supplied display name in `customName` as a local/server display snapshot while retaining `productId`. Existing synced records that have no snapshot resolve their name through the existing cached `useProduct(productId)` query in the pantry card. This repairs current device data without a database migration; newly created records remain correctly named offline.

### Duplicate warning

Before creating an active product-backed record, query active local records in the effective personal or household pantry. If the same `productId` exists, show a confirmation explaining that this may be another package with a different expiry date. Actions are `Cancel` and `Add with different expiry`; only the latter creates the record. Custom-name-only records are unchanged.

### Expiry selection and OCR

Replace the editable expiry text field with the platform-native date picker. Android uses `DateTimePickerAndroid.open` in date mode; the visible field is a button displaying the selected ISO date or a selection prompt. Date conversion uses local calendar fields to avoid timezone day shifts.

ML Kit receives `file://<photo path>` on Android. A recognized date updates the form's selected expiry value immediately. OCR errors stay on the camera screen and manual selection remains available.

## Testing and verification

- Add failing component/unit tests for permission-state mapping, login input props, passkey option requests, duplicate confirmation, product-name persistence, OCR-prefill behavior, date-picker selection, and save navigation independence from push registration.
- Run focused Jest tests, mobile typecheck, and relevant API tests.
- Build the debug APK with the local Gradle/Android toolchain, install it with `adb install -r`, and verify on the Mi 9.
- Device checks cover permission reset and system dialog, existing-passkey login, barcode add completion, duplicate confirmation, correct pantry name, OCR date capture, and native date selection.

## Out of scope

- Deleting or replacing passkeys in Google Password Manager.
- Redesigning the record API schema or pantry database.
- Deploying backend changes or changing production credentials.
