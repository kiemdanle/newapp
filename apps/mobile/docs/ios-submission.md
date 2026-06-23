# iOS App Store submission runbook

Walk through end-to-end. First-time setup ~2 hours of operator time.

## App Store Connect setup

1. Sign in at https://appstoreconnect.apple.com with the Pantry developer account
2. **My Apps → "+" → New App**
3. Fields:
   - Platforms: **iOS**
   - Name: **Pantry**
   - Primary language: English (US)
   - Bundle ID: `com.expyrico.app`
   - SKU: `pantry-2024`
   - User access: Full access

## App information

- **Subtitle (30 chars):** "Track expiry. Don't waste."
- **Promotional text (170 chars):** "Scan groceries, set expiry dates, get reminders before they go bad. Rate products with the community. Privacy-first: no analytics, your pantry stays yours."
- **Description (4000 chars):** see `/docs/legal/store-description-ios.md` (write if not present; for first submission a 1-paragraph version is acceptable)
- **Keywords (100 chars):** `pantry,expiry,expiration,grocery,barcode,scan,food,waste,reminder,fridge`
- **Support URL:** https://pantry.example/support
- **Marketing URL:** https://pantry.example
- **Privacy Policy URL:** https://pantry.example/privacy (must match `/docs/legal/privacy-policy.md`)

## Screenshots

Required device sizes (portrait, 6.5" and 5.5" are mandatory):

| Device        | Resolution       | Count |
|---------------|------------------|-------|
| 6.5" iPhone   | 1242 × 2688      | 3–10  |
| 5.5" iPhone   | 1242 × 2208      | 3–10  |
| 6.7" iPhone   | 1290 × 2796      | 3–10  |
| 12.9" iPad    | 2048 × 2732      | 3–10  |

Recommended screens to capture:
1. Pantry home with 4 records
2. Scan screen with viewfinder
3. Product detail with reviews
4. Theme switcher showing 4 previews
5. Settings → Notifications

Capture on a real device via Xcode → Devices → Take Screenshot, or via the iOS simulator at exact device dimensions.

## Privacy nutrition label

Apple → "App Privacy" → answers:

- Does this app collect data? **Yes**
- Data Linked to You:
  - **Contact Info → Email Address** (account)
  - **Identifiers → User ID** (account)
  - **User Content → Other User Content** (records, reviews)
- Data Not Linked to You:
  - **Diagnostics → Crash Data** (via Apple's opt-in)
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
- Account deletion: present — `DELETE /me` wired to Settings → Account → Delete
- Crashes during review: test the demo account flow yourself on a clean device before submitting
- Vague Privacy Policy: ensure `/docs/legal/privacy-policy.md` is published at the URL listed
