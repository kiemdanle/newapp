# Native secrets

The following files contain real secrets / credentials and must **never** be committed.
Example placeholders are committed so CI and new contributors know what files are expected.

| File | Purpose | Example placeholder |
|---|---|---|
| `apps/mobile/android/app/google-services.json` | Firebase Android config (FCM + Google Sign-In) | `google-services.json.example` |
| `apps/mobile/ios/GoogleService-Info.plist` | Firebase iOS config (FCM + Google Sign-In) | `GoogleService-Info.plist.example` |
| `api/serviceAccount*.json` | Firebase Admin SDK service account key | `serviceAccount.json.example` |
| `*.keystore`, `*.jks` | Android app signing material | Generate locally via `keytool` |
| `*.p8`, `*.p12` | Apple push/AuthKey/signing material | Download from Apple Developer / App Store Connect |

Add real copies to `.env`/keystores locally; the CI pipeline injects them at build time.
