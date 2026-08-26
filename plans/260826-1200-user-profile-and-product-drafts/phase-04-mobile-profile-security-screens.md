---
phase: 4
title: "Mobile Profile & Security Screens"
status: pending
priority: P1
dependencies: ["phase-02-backend-api-routes-services.md", "phase-03-country-locale-regional-formatting-engine.md"]
---

# Phase 4: Mobile Profile & Security Screens
<!-- Updated: Red Team Review - Dual token secure-store synchronization & optimistic update safety -->

## Overview
This phase delivers the mobile user interface for profile viewing and editing, avatar management (camera and photo library upload with 512x512 high-resolution rendering), address entry, country selection with regional preview, and password security (updating existing passwords or setting a new password for OAuth/Passkey accounts with seamless dual-token synchronization).

## Requirements

### Functional Requirements
1. **Reusable `Avatar` Component (`apps/mobile/src/components/Avatar.tsx`)**:
   - Renders high-resolution image from `avatarUrl` when available.
   - Falls back gracefully to uppercase initials with theme-tinted background (`Mint Mist #D6F0E6` / `Fresh Sage #4BAE8A`).
   - Supports sizes: `xs` (24px), `sm` (32px), `md` (44px), `lg` (56px), `xl` (80px), `xxl` (104px).
   - Supports optional editable badge (camera icon) with press handler.
2. **`CountryPickerModal` Component (`apps/mobile/src/components/CountryPickerModal.tsx`)**:
   - Searchable bottom sheet / modal listing all supported countries with flags, names, and codes.
   - Highlights the currently selected country.
3. **Profile Tab Screen Modernization (`apps/mobile/app/(app)/(tabs)/profile.tsx`)**:
   - Hero User Card featuring the new `Avatar`, user full name, verified email indicator, country flag/badge, and address preview.
   - Distinct Action Rows:
     - 📝 **Edit Profile** -> navigates to `ProfileEdit`.
     - 🔑 **Password & Security** -> navigates to `ProfilePassword`.
     - 📦 **My Product Drafts** -> navigates to `ProductDrafts`.
     - ⚙️ **Settings** -> navigates to `SettingsIndex`.
     - 🚪 **Sign Out** -> confirmation alert and logout.
4. **Edit Profile Screen (`apps/mobile/app/(app)/profile/edit.tsx`)**:
   - **Avatar Editor**: Displays `xxl` avatar with "Change Photo" action sheet:
     - "Take Photo" (via camera)
     - "Choose from Library" (via photo picker)
     - "Remove Photo" (if custom avatar exists)
     - Upload progress spinner and instant update in session store upon server confirmation.
   - **Personal Info Fields**:
     - First Name (`TextField`, required, 1-80 chars).
     - Last Name (`TextField`, required, 1-80 chars).
     - Email (`TextField`, disabled, with verified badge).
   - **Address & Regional Fields**:
     - Address (`TextField`, optional, max 255 chars, e.g. "123 Market St, Apt 4B").
     - Country Selector (triggers `CountryPickerModal`).
     - Regional Impact Callout: Dynamically displays how date format and currency will look for the selected country.
   - **Save CTA**: Submits patch to `PATCH /me`, updates session store only after server 200 response, and notifies with success banner.
5. **Password & Security Screen (`apps/mobile/app/(app)/profile/password.tsx`)**:
   - Dynamic mode detection based on `user.hasPassword`:
     - **Change Password** (for users with password): Requires `Current Password`, `New Password`, `Confirm New Password`.
     - **Set Password** (for passwordless OAuth/Passkey users): Requires `New Password`, `Confirm New Password`.
   - Real-time password requirement checklist (minimum 8 characters, password confirmation match).
   - Secure text entry toggles (show/hide password eye icon).
   - **Dual Token Synchronization**: When `PUT /me/password` returns `{ tokens: { accessToken, refreshToken }, user }`, invokes `secureStore.setAccessToken(accessToken)` and `secureStore.setRefreshToken(refreshToken)` and updates `useSessionStore` immediately so all subsequent network requests remain authenticated without forcing a logout.
6. **Navigation Wiring (`apps/mobile/src/navigation/AppNavigator.tsx`)**:
   - Add `ProfileEdit: undefined` and `ProfilePassword: undefined` to `AppStackParamList` and register stack screens with native back headers.

### Non-functional Requirements
- Compliance with Expyrico color guidelines: Fresh Sage `#4BAE8A`, Deep Sage `#3A8F6F`, Mint Mist `#D6F0E6`, Warm White `#FAFAF8`, Honey `#F5A623`, Stone `#F0F0ED`, Almost Black `#2C2C28`, Alert Red `#E0442A`.
- Unsaved changes alert guard on back navigation if form is dirty.
- Keyboard-aware scrolling for form inputs.

## Screen Mockup Flow

```
+---------------------------+        +---------------------------+
|        Profile Tab        |        |     Edit Profile Screen   |
|  +---------------------+  |        |  [  Avatar (XXL) + 📷 ]   |
|  | [Avatar] Dan Le     |  | -----> |  First Name: [ Dan      ] |
|  | dan@example.com [v] |  |        |  Last Name:  [ Le       ] |
|  | 🇺🇸 United States    |  |        |  Address:    [ 123 Main ] |
|  +---------------------+  |        |  Country:    [ 🇺🇸 US  v ] |
|  > Edit profile           |        |  [ Save Profile Changes ] |
|  > Password & security    |----+   +---------------------------+
|  > My product drafts      |    |
|  > Settings               |    |   +---------------------------+
|  > Sign out               |    |   |    Password & Security    |
+---------------------------+    +-> |  Current Password: [*** ] |
                                     |  New Password:     [*** ] |
                                     |  Confirm Password: [*** ] |
                                     |  [ Update Password ]      |
                                     +---------------------------+
```

## Related Code Files
- Create: `apps/mobile/src/components/Avatar.tsx`
- Create: `apps/mobile/src/components/CountryPickerModal.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Create: `apps/mobile/app/(app)/profile/edit.tsx`
- Create: `apps/mobile/app/(app)/profile/password.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/src/api/endpoints.ts`

## Implementation Steps
1. Create `Avatar.tsx` with size variants and fallback initials in `apps/mobile/src/components/Avatar.tsx`.
2. Create `CountryPickerModal.tsx` with search and flag list in `apps/mobile/src/components/CountryPickerModal.tsx`.
3. Add API client endpoints in `apps/mobile/src/api/endpoints.ts` for `meEndpoints.uploadAvatar`, `meEndpoints.deleteAvatar`, and `meEndpoints.changePassword`.
4. Create `EditProfileScreen` in `apps/mobile/app/(app)/profile/edit.tsx` with avatar photo selection, text fields, country picker, and save mutation.
5. Create `PasswordScreen` in `apps/mobile/app/(app)/profile/password.tsx` with password change / set logic, validation checks, and `secureStore` token synchronization.
6. Refactor `apps/mobile/app/(app)/(tabs)/profile.tsx` to display the modernized user card and menu options.
7. Register `ProfileEdit` and `ProfilePassword` screens in `apps/mobile/src/navigation/AppNavigator.tsx`.

## Success Criteria
- [ ] Profile tab displays avatar image, full name, email, and country badge.
- [ ] Tapping "Edit Profile" opens `EditProfileScreen` and pre-populates existing user details.
- [ ] User can pick a new avatar image from camera/gallery and upload it successfully.
- [ ] User can update first name, last name, address, and country, with immediate updates reflected across the app.
- [ ] Tapping "Password & Security" opens `PasswordScreen` with correct mode (Change vs Set password).
- [ ] Password updates enforce 8+ characters and matching confirmation, refreshing `secureStore` tokens seamlessly.

## Risk Assessment
- **Risk**: Native camera/gallery permission denial on Android/iOS.
  - **Mitigation**: Handle permission requests gracefully, alerting the user with an actionable explanation if permissions are denied.
- **Risk**: Avatar cache staleness when user replaces avatar multiple times.
  - **Mitigation**: Include timestamp query parameter or unique UUID in avatar URLs to force image cache refreshes.
