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
  package: 'com.expyrico.app',
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
3. Answer all "No" for violence/sex/profanity/etc. User-generated reviews are profanity-filtered server-side, so answer "Yes — moderated"
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
