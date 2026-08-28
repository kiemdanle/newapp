# Red Team Review Report: Admin 2FA Recovery and Reset Mechanism

**Target Plan:** `plans/260828-0500-admin-2fa-recovery-and-reset-mechanism/plan.md`  
**Review Lenses:** Security Adversary, Failure Mode Analyst, Assumption Destroyer  
**Total Findings:** 5  
**Evidence-Filtered Pass Rate:** 5/5 (100% backed by `file:line` codebase evidence)  
**Proposed Adjudication:** 5 Accepted, 0 Rejected  

---

## Findings Summary

### Finding 1: In-Memory `PENDING_ENROLLMENTS` Map Can Leak Stale TOTP Secrets on Re-Enrollment — HIGH
- **Reviewer:** Failure Mode Analyst / Security Adversary
- **Location:** Phase 2, Section "Backend API & Atomic Purge"
- **Flaw:** `api/src/routes/auth/totp.ts:19,93-100` maintains an in-memory `PENDING_ENROLLMENTS` cache keyed by `userId`. If an admin started an enrollment in the past that was abandoned or if 2FA was cleared while an in-memory build was pending, `/totp/enroll` reuses the stale secret instead of generating a clean new secret.
- **Evidence:** `api/src/routes/auth/totp.ts:19` (`const PENDING_ENROLLMENTS = new Map...`) and `api/src/routes/auth/totp.ts:93-100` (`const existing = PENDING_ENROLLMENTS.get(user.id); if (existing) return ...`).
- **Suggested Fix:** Add and call `clearPendingEnrollment(userId)` during the 2FA reset flow to purge any cached in-memory enrollment states.
- **Disposition:** **Accept**

---

### Finding 2: CLI Script Must Use `tsx --env-file=.env` to Match Workspace ESM Loader — MEDIUM
- **Reviewer:** Assumption Destroyer
- **Location:** Phase 2, Section "Disaster Recovery CLI Tool"
- **Flaw:** The plan assumed generic Node invocation without matching the project's `--env-file=.env` loader setup. Running without `.env` will fail with missing database connection strings (`DATABASE_URL`).
- **Evidence:** `api/package.json:24` uses `"seed:admin": "tsx --env-file=.env prisma/seed-admin.ts"`.
- **Suggested Fix:** Specify `"admin:reset-2fa": "tsx --env-file=.env prisma/reset-admin-2fa.ts"` in `api/package.json` to ensure immediate `.env` loading in standalone executions.
- **Disposition:** **Accept**

---

### Finding 3: Server Action Must Use `ActionResult<T>` Pattern for Typed Conflict & Error Surfacing — HIGH
- **Reviewer:** Failure Mode Analyst
- **Location:** Phase 3, Section "Admin API Client & Server Actions"
- **Flaw:** Direct throwing in Server Actions fails to preserve structured problem detail codes (e.g. `cannot_reset_unenrolled_2fa`) across the Next.js server/client boundary.
- **Evidence:** `apps/admin/src/lib/actions.ts:26-42` defines `runAction` returning `ActionResult<T>` to preserve `ApiError` code and detail across Server Action boundaries.
- **Suggested Fix:** Implement `resetUser2faAction` using `runAction(() => serverAdminApi.users.reset2fa(id, body))` so the client UI can render friendly, typed alerts.
- **Disposition:** **Accept**

---

### Finding 4: Inconsistency in Admin Demotion/Revocation Route — MEDIUM
- **Reviewer:** Security Adversary
- **Location:** Phase 2, Section "Related Code Files"
- **Flaw:** `api/src/routes/admin/settings/admins.ts:42-50` (`DELETE /admins/:id`) demotes an admin to user and bumps `tokenVersion`, but does not revoke `AdminTrustedDevice` entries or active `Session` rows, unlike `api/src/routes/admin/users/patch.ts:25-34`.
- **Evidence:** `api/src/routes/admin/settings/admins.ts:47` (`await getPrisma().user.update(...)`) lacks the trusted device and session cleanup present in `api/src/routes/admin/users/patch.ts:26-33`.
- **Suggested Fix:** Ensure the 2FA reset implementation does not rely on admin revocation logic, and explicitly executes all device, session, and recovery code deletions inside its own atomic transaction.
- **Disposition:** **Accept**

---

### Finding 5: Self-Reset Guardrail & UI Warning — MEDIUM
- **Reviewer:** Security Adversary
- **Location:** Phase 3, Section "User Detail Page Touchpoint"
- **Flaw:** An administrator clicking "Reset 2FA" on their own profile without realizing it will immediately kill their current browser session (due to `tokenVersion` bump and `Session` revocation) would experience a jarring logout.
- **Evidence:** `api/src/plugins/auth.ts:43-45` rejects access tokens immediately when `req.user.tokenVersion !== user.tokenVersion`.
- **Suggested Fix:** Update the confirmation dialog for self-resets to clearly display: *"You are resetting your own 2FA. This will log you out immediately and require you to scan a new QR code upon signing in."*
- **Disposition:** **Accept**
