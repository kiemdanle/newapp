# Pantry Privacy Policy

**Effective date:** 2026-06-18
**Last updated:** 2026-06-18

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
